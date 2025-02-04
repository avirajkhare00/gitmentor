import OpenAI from 'openai';
import { DeveloperProfile } from './github';

export interface DeveloperAnalysis {
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  technicalAssessment: string;
  profileRating: {
    score: number;
    explanation: string;
  };
}

export type AnalysisSection = keyof DeveloperAnalysis;

export interface AnalysisUpdate {
  section: AnalysisSection;
  data: string[] | string | { score: number; explanation: string };
}

export type AnalysisCallback = (update: AnalysisUpdate) => void;

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private prepareProfileData(profile: DeveloperProfile): { languagePercentages: string; repoSummaries: string } {
    const totalBytes = Object.values(profile.languageStats).reduce((a, b) => a + b, 0);
    const languagePercentages = totalBytes > 0
      ? Object.entries(profile.languageStats)
          .map(([lang, bytes]) => `${lang}: ${((bytes / totalBytes) * 100).toFixed(1)}%`)
          .join(', ')
      : 'Language statistics not available';

    const repoSummaries = profile.repositories
      .map(repo => {
        const languages = Object.entries(repo.languages).length > 0
          ? Object.entries(repo.languages)
              .map(([lang, bytes]) => `${lang} (${((bytes / Object.values(repo.languages).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`)
              .join(', ')
          : repo.language || 'Not specified';

        return `
Repository: ${repo.name}
Description: ${repo.description || 'No description'}
Main Language: ${repo.language || 'Not specified'}
Languages: ${languages}
Stars: ${repo.stargazersCount}
Forks: ${repo.forksCount}
Topics: ${repo.topics.join(', ') || 'None'}
${repo.isFork ? `Forked: Yes${repo.hasContributions ? `, Contributions: ${repo.contributionsCount}` : ''}` : 'Forked: No'}`;
      })
      .join('\n---\n');

    return { languagePercentages, repoSummaries };
  }

  private async getProfileRating(profile: DeveloperProfile, languagePercentages: string, repoSummaries: string): Promise<{ score: number; explanation: string }> {
    const prompt = `As a technical evaluator, analyze this GitHub profile and provide a rating out of 10:

User: ${profile.user.name || profile.user.username}
Bio: ${profile.user.bio || 'No bio'}
Public Repos: ${profile.user.publicRepos}
Followers: ${profile.user.followers}
Following: ${profile.user.following}
Account Created: ${profile.user.createdAt}

Overall Language Distribution:
${languagePercentages}

Top Repositories:
${repoSummaries}

Provide a rating out of 10 for this developer's GitHub profile, considering:
1. Code quality and project diversity
2. Technical expertise and language proficiency
3. Contribution frequency and consistency
4. Project impact (stars, forks, etc.)
5. Documentation and code organization

Format your response as:
Rating: [X]/10
Explanation: [Brief explanation of the rating]`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced technical evaluator who provides fair and objective ratings of developer profiles. Be specific and evidence-based in your assessment."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message?.content;
    if (!content) throw new Error('Failed to get profile rating');

    const ratingMatch = content.match(/Rating:\s*(\d+(?:\.\d+)?)/);
    
    if (!ratingMatch) {
      throw new Error('Failed to parse rating response');
    }

    // Convert the matched rating to a number and divide by 10 if needed
    const rating = parseFloat(ratingMatch[1]);

    const explanationMatch = content.match(/Explanation:\s*(.*)/);

    if (!explanationMatch) {
      throw new Error('Failed to parse explanation response');
    }

    return {
      score: rating,
      explanation: explanationMatch[1].trim(),
    };
  }

  private async getStrengths(profile: DeveloperProfile, languagePercentages: string, repoSummaries: string): Promise<string[]> {
    const prompt = `As a developer career advisor, analyze this GitHub profile for key strengths:

User: ${profile.user.name || profile.user.username}
Bio: ${profile.user.bio || 'No bio'}
Public Repos: ${profile.user.publicRepos}
Followers: ${profile.user.followers}
Following: ${profile.user.following}
Account Created: ${profile.user.createdAt}

Overall Language Distribution:
${languagePercentages}

Top Repositories:
${repoSummaries}

Provide 3-4 key strengths of this developer based on their GitHub profile. Focus on technical skills, project diversity, and development practices.
Format each strength as a clear, concise bullet point.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced technical mentor focusing on identifying developer strengths. Provide specific, evidence-based strengths."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message?.content;
    if (!content) throw new Error('Failed to get strengths analysis');
    
    return content.split('\n')
      .map(line => line.replace(/^-\s*|\d+\.\s*/, '').trim())
      .filter(line => line);
  }

  private async getAreasForImprovement(profile: DeveloperProfile, languagePercentages: string, repoSummaries: string): Promise<string[]> {
    const prompt = `As a developer career advisor, analyze this GitHub profile for areas of improvement:

User: ${profile.user.name || profile.user.username}
Bio: ${profile.user.bio || 'No bio'}
Public Repos: ${profile.user.publicRepos}
Followers: ${profile.user.followers}
Following: ${profile.user.following}
Account Created: ${profile.user.createdAt}

Overall Language Distribution:
${languagePercentages}

Top Repositories:
${repoSummaries}

Provide 2-3 specific areas where this developer could improve. Focus on constructive feedback that would enhance their profile and skills.
Format each area as a clear, concise bullet point.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced technical mentor focusing on identifying areas for developer growth. Provide constructive, actionable feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message?.content;
    if (!content) throw new Error('Failed to get areas for improvement analysis');
    
    return content.split('\n')
      .map(line => line.replace(/^-\s*|\d+\.\s*/, '').trim())
      .filter(line => line);
  }

  private async getRecommendations(profile: DeveloperProfile, languagePercentages: string, repoSummaries: string): Promise<string[]> {
    const prompt = `As a developer career advisor, provide specific recommendations for this GitHub profile:

User: ${profile.user.name || profile.user.username}
Bio: ${profile.user.bio || 'No bio'}
Public Repos: ${profile.user.publicRepos}
Followers: ${profile.user.followers}
Following: ${profile.user.following}
Account Created: ${profile.user.createdAt}

Overall Language Distribution:
${languagePercentages}

Top Repositories:
${repoSummaries}

Provide 3-4 specific recommendations for growth and improvement. Focus on actionable steps that would enhance their profile and career prospects.
Format each recommendation as a clear, concise bullet point.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced technical mentor focusing on providing actionable recommendations for developer growth. Provide specific, practical advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message?.content;
    if (!content) throw new Error('Failed to get recommendations analysis');
    
    return content.split('\n')
      .map(line => line.replace(/^-\s*|\d+\.\s*/, '').trim())
      .filter(line => line);
  }

  private async getTechnicalAssessment(profile: DeveloperProfile, languagePercentages: string, repoSummaries: string): Promise<string> {
    const prompt = `As a developer career advisor, provide a technical assessment of this GitHub profile:

User: ${profile.user.name || profile.user.username}
Bio: ${profile.user.bio || 'No bio'}
Public Repos: ${profile.user.publicRepos}
Followers: ${profile.user.followers}
Following: ${profile.user.following}
Account Created: ${profile.user.createdAt}

Overall Language Distribution:
${languagePercentages}

Top Repositories:
${repoSummaries}

Provide a brief technical assessment of this developer's skills and expertise. Focus on their technical proficiency, project complexity, and development patterns.
Keep the assessment concise but informative.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an experienced technical mentor focusing on technical assessment. Provide a concise but comprehensive technical evaluation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message?.content;
    if (!content) throw new Error('Failed to get technical assessment');
    
    return content.trim();
  }

  async analyzeDeveloperProfile(
    profile: DeveloperProfile,
    onUpdate?: AnalysisCallback
  ): Promise<DeveloperAnalysis> {
    try {
      // Special case for 'torvalds' username
      if (profile.user.username.toLowerCase() === 'torvalds') {
        const analysis: DeveloperAnalysis = {
          strengths: ['I created git bro'],
          areasForImprovement: ['I created git bro'],
          recommendations: ['I created git bro'],
          technicalAssessment: 'I created git bro',
          profileRating: {
            score: 10,
            explanation: 'I created git bro'
          }
        };
        
        // Notify callback for each section if provided
        if (onUpdate) {
          Object.entries(analysis).forEach(([section, data]) => {
            onUpdate({ section: section as AnalysisSection, data });
          });
        }
        
        return analysis;
      }

      const { languagePercentages, repoSummaries } = this.prepareProfileData(profile);

      // Create an object to store the analysis results
      const analysis: DeveloperAnalysis = {
        strengths: [],
        areasForImprovement: [],
        recommendations: [],
        technicalAssessment: '',
        profileRating: {
          score: 0,
          explanation: ''
        }
      };

      // Helper function to update a section and notify callback
      const updateSection = (section: AnalysisSection, data: string[] | string | { score: number; explanation: string }) => {
        if (section === 'technicalAssessment') {
          (analysis[section] as string) = data as string;
        } else if (section === 'profileRating') {
          analysis[section] = data as { score: number; explanation: string };
        } else {
          (analysis[section] as string[]) = data as string[];
        }
        onUpdate?.({ section, data });
      };

      // Start all API calls in parallel but handle their results independently
      const promises = [
        this.getStrengths(profile, languagePercentages, repoSummaries)
          .then(data => updateSection('strengths', data))
          .catch(error => {
            console.error('Error getting strengths:', error);
            updateSection('strengths', ['Failed to analyze strengths']);
          }),

        this.getAreasForImprovement(profile, languagePercentages, repoSummaries)
          .then(data => updateSection('areasForImprovement', data))
          .catch(error => {
            console.error('Error getting areas for improvement:', error);
            updateSection('areasForImprovement', ['Failed to analyze areas for improvement']);
          }),

        this.getRecommendations(profile, languagePercentages, repoSummaries)
          .then(data => updateSection('recommendations', data))
          .catch(error => {
            console.error('Error getting recommendations:', error);
            updateSection('recommendations', ['Failed to get recommendations']);
          }),

        this.getTechnicalAssessment(profile, languagePercentages, repoSummaries)
          .then(data => updateSection('technicalAssessment', data))
          .catch(error => {
            console.error('Error getting technical assessment:', error);
            updateSection('technicalAssessment', 'Failed to get technical assessment');
          }),

        this.getProfileRating(profile, languagePercentages, repoSummaries)
          .then(data => updateSection('profileRating', data))
          .catch(error => {
            console.error('Error getting profile rating:', error);
            updateSection('profileRating', { score: 0, explanation: 'Failed to get profile rating' });
          })
      ];

      // Wait for all promises to complete
      await Promise.all(promises);

      return analysis;
    } catch (error: any) {
      console.error('Error in analyzeDeveloperProfile:', error);
      throw new Error(`Failed to analyze developer profile: ${error.message}`);
    }
  }
}
