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
  parentRepository?: {
    fullName: string;
    url: string;
  };
  hasContributions?: boolean;
  contributionsCount?: number;
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

  private async checkForkContributions(username: string, repo: string, owner: string): Promise<{ hasContributions: boolean; count: number }> {
    try {
      // Get all commits by the user in this repository
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        author: username,
        per_page: 100 // Limit to 100 commits for performance
      });

      return {
        hasContributions: commits.length > 0,
        count: commits.length
      };
    } catch (error: any) {
      await this.handleRateLimitError(error);
      return { hasContributions: false, count: 0 };
    }
  }

  async getUserRepositories(username: string): Promise<Repository[]> {
    try {
      // First, get all repositories including forks
      const { data } = await this.octokit.rest.repos.listForUser({
        username,
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        type: 'all' // Changed from 'owner' to 'all' to include forks
      });
      
      // Filter out archived repositories but keep forks
      const filteredRepos = data
        .filter(repo => !repo.archived)
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 15); // Increased limit to include some forks

      // Fetch languages and contribution data for each repository in parallel
      const reposWithDetails = await Promise.all(
        filteredRepos.map(async repo => {
          const languages = await this.getRepositoryLanguages(repo.owner.login, repo.name);
          
          let contributionData = { hasContributions: false, count: 0 };
          let parentRepo = undefined;
          
          if (repo.fork) {
            // For forks, get the parent repository info
            const { data: repoData } = await this.octokit.rest.repos.get({
              owner: repo.owner.login,
              repo: repo.name
            });
            
            if (repoData.parent) {
              parentRepo = {
                fullName: repoData.parent.full_name,
                url: repoData.parent.html_url
              };
              
              // Check for contributions in the fork
              contributionData = await this.checkForkContributions(
                username,
                repo.name,
                repo.owner.login
              );
            }
          }

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
            parentRepository: parentRepo,
            hasContributions: contributionData.hasContributions,
            contributionsCount: contributionData.count
          };
        })
      );

      // Sort repositories: owned repos first, then forks with contributions
      return reposWithDetails.sort((a, b) => {
        if (a.isFork === b.isFork) {
          // If both are forks or both are not forks, sort by stars
          return (b.stargazersCount || 0) - (a.stargazersCount || 0);
        }
        // Put non-forks first
        return a.isFork ? 1 : -1;
      });

    } catch (error: any) {
      await this.handleRateLimitError(error);
      throw new Error(`Failed to fetch user repositories: ${error.message}`);
    }
  }
}
