import OpenAI from 'openai';
import { DeveloperProfile } from './github';

export interface DeveloperAnalysis {
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  technicalAssessment: string;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeDeveloperProfile(profile: DeveloperProfile): Promise<DeveloperAnalysis> {
    try {
      // Prepare the data for analysis
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
Languages Used: ${languages}
Stars: ${repo.stargazersCount}
Forks: ${repo.forksCount}
Topics: ${repo.topics.join(', ') || 'None'}`;
        })
        .join('\n---\n');

      const prompt = `As a developer career advisor, analyze this GitHub profile:

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

Based on this information, provide:
1. Key strengths (3-4 points)
2. Areas for improvement (2-3 points)
3. Specific recommendations for growth (3-4 points)
4. Brief technical assessment

Note: Some repository data might be limited due to API rate limits.
Focus on actionable insights based on available data.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an experienced technical mentor and career advisor, specializing in developer growth and best practices. Provide constructive feedback even with limited data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
      });

      const analysis = response.choices[0].message?.content;
      
      if (!analysis) {
        throw new Error('Failed to get analysis from OpenAI');
      }

      // Parse the response into structured format
      const sections = analysis.split('\n\n');
      const strengths: string[] = [];
      const areasForImprovement: string[] = [];
      const recommendations: string[] = [];
      let technicalAssessment = '';

      sections.forEach(section => {
        if (section.toLowerCase().includes('strength')) {
          strengths.push(...section.split('\n').slice(1).filter(s => s.trim()));
        } else if (section.toLowerCase().includes('improvement')) {
          areasForImprovement.push(...section.split('\n').slice(1).filter(s => s.trim()));
        } else if (section.toLowerCase().includes('recommendation')) {
          recommendations.push(...section.split('\n').slice(1).filter(s => s.trim()));
        } else if (section.toLowerCase().includes('technical assessment')) {
          technicalAssessment = section.split('\n').slice(1).join('\n').trim();
        }
      });

      return {
        strengths,
        areasForImprovement,
        recommendations,
        technicalAssessment,
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze developer profile`);
    }
  }
}
