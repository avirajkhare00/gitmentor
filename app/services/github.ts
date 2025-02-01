import { Octokit } from 'octokit';

export interface GithubUserData {
  username: string;
  name: string | null;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  avatarUrl: string;
}

export interface Repository {
  name: string;
  description: string | null;
  language: string | null;
  languages: { [key: string]: number };
  stargazersCount: number | undefined;
  forksCount: number | undefined;
  updatedAt: string | undefined;
  topics: string[];
  isArchived: boolean | undefined;
  isFork: boolean;
  readme: string | null;
}

export interface DeveloperProfile {
  user: GithubUserData;
  repositories: Repository[];
  languageStats: { [key: string]: number };
}

export class GithubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit(
      process.env.GITHUB_ACCESS_TOKEN 
        ? { auth: process.env.GITHUB_ACCESS_TOKEN }
        : {} 
    );
    
    if (!process.env.GITHUB_ACCESS_TOKEN) {
      console.warn('Running GitHub service without authentication. Rate limits will be restricted to 60 requests per hour.');
    }
  }

  private async handleRateLimitError(error: any): Promise<never> {
    if (error.status === 403 && error.message.includes('API rate limit exceeded')) {
      try {
        // Get rate limit information
        const { data } = await this.octokit.rest.rateLimit.get();
        const resetDate = new Date(data.rate.reset * 1000);
        const minutesToWait = Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60));
        
        throw new Error(
          `GitHub API rate limit exceeded. Please try again in ${minutesToWait} minutes ` +
          `(at ${resetDate.toLocaleTimeString()}). ` +
          `Consider adding a GitHub token for higher limits.`
        );
      } catch (rateError) {
        // If we can't get rate limit info, throw a generic message
        throw new Error(
          'GitHub API rate limit exceeded. Please try again in an hour or add a GitHub token for higher limits.'
        );
      }
    }
    throw error;
  }

  async getUserProfile(username: string): Promise<GithubUserData> {
    try {
      const { data } = await this.octokit.rest.users.getByUsername({ username });
      
      return {
        username: data.login,
        name: data.name,
        bio: data.bio,
        publicRepos: data.public_repos,
        followers: data.followers,
        following: data.following,
        createdAt: data.created_at,
        avatarUrl: data.avatar_url,
      };
    } catch (error: any) {
      await this.handleRateLimitError(error);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }
  }

  private async getRepositoryReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getReadme({
        owner,
        repo,
        mediaType: {
          format: 'raw',
        },
      });
      return data as unknown as string;
    } catch (error: any) {
      await this.handleRateLimitError(error);
      return null;
    }
  }

  private async getRepositoryLanguages(owner: string, repo: string): Promise<{ [key: string]: number }> {
    try {
      const { data } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo,
      });
      return data;
    } catch (error: any) {
      await this.handleRateLimitError(error);
      return {};
    }
  }

  async getDeveloperProfile(username: string): Promise<DeveloperProfile> {
    const [user, repositories] = await Promise.all([
      this.getUserProfile(username),
      this.getUserRepositories(username),
    ]);

    // Calculate overall language statistics
    const languageStats: { [key: string]: number } = {};
    repositories.forEach(repo => {
      Object.entries(repo.languages).forEach(([language, bytes]) => {
        languageStats[language] = (languageStats[language] || 0) + bytes;
      });
    });

    return {
      user,
      repositories,
      languageStats,
    };
  }

  async getUserRepositories(username: string): Promise<Repository[]> {
    try {
      const { data } = await this.octokit.rest.repos.listForUser({
        username,
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
        type: 'owner'
      });
      
      const filteredRepos = data
        .filter(repo => !repo.fork && !repo.archived)
        .slice(0, 5);

      // Fetch languages for each repository in parallel, skip README to reduce API calls
      const reposWithDetails = await Promise.all(
        filteredRepos.map(async repo => {
          const languages = await this.getRepositoryLanguages(username, repo.name);

          return {
            name: repo.name,
            description: repo.description,
            language: repo.language ?? null,
            languages,
            stargazersCount: repo.stargazers_count,
            forksCount: repo.forks_count,
            updatedAt: repo.updated_at ?? undefined,
            topics: repo.topics || [],
            isArchived: repo.archived,
            isFork: repo.fork,
            readme: null, // Skip README fetching to reduce API calls
          };
        })
      );

      return reposWithDetails;
    } catch (error: any) {
      await this.handleRateLimitError(error);
      throw new Error(`Failed to fetch user repositories: ${error.message}`);
    }
  }
}
