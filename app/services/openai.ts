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

      let currentSection = '';
      sections.forEach(section => {
        const lowerSection = section.toLowerCase();
        if (lowerSection.includes('strength') || lowerSection.startsWith('1.')) {
          currentSection = 'strengths';
          const lines = section.split('\n')
            .filter(line => line.trim() && !line.toLowerCase().includes('strength'))
            .map(line => line.replace(/^\d+\.\s*|-\s*/, '').trim())
            .filter(line => line);
          strengths.push(...lines);
        } else if (lowerSection.includes('improvement') || lowerSection.startsWith('2.')) {
          currentSection = 'improvements';
          const lines = section.split('\n')
            .filter(line => line.trim() && !line.toLowerCase().includes('improvement'))
            .map(line => line.replace(/^\d+\.\s*|-\s*/, '').trim())
            .filter(line => line);
          areasForImprovement.push(...lines);
        } else if (lowerSection.includes('recommendation') || lowerSection.startsWith('3.')) {
          currentSection = 'recommendations';
          const lines = section.split('\n')
            .filter(line => line.trim() && !line.toLowerCase().includes('recommendation'))
            .map(line => line.replace(/^\d+\.\s*|-\s*/, '').trim())
            .filter(line => line);
          recommendations.push(...lines);
        } else if (lowerSection.includes('technical assessment') || lowerSection.startsWith('4.')) {
          currentSection = 'assessment';
          const lines = section.split('\n')
            .filter(line => line.trim() && !line.toLowerCase().includes('technical assessment'))
            .join('\n')
            .trim();
          if (lines) {
            technicalAssessment = lines;
          }
        } else if (section.trim()) {
          // If we're in a section but the text doesn't start with a new section header,
          // append it to the current section
          const lines = section.split('\n')
            .map(line => line.replace(/^\d+\.\s*|-\s*/, '').trim())
            .filter(line => line);
          
          switch (currentSection) {
            case 'strengths':
              strengths.push(...lines);
              break;
            case 'improvements':
              areasForImprovement.push(...lines);
              break;
            case 'recommendations':
              recommendations.push(...lines);
              break;
            case 'assessment':
              technicalAssessment += '\n' + lines.join('\n');
              break;
          }
        }
      });

      // Ensure we have at least empty arrays/strings for each field
      return {
        strengths: strengths.length > 0 ? strengths : ['No strengths identified'],
        areasForImprovement: areasForImprovement.length > 0 ? areasForImprovement : ['No areas for improvement identified'],
        recommendations: recommendations.length > 0 ? recommendations : ['No specific recommendations available'],
        technicalAssessment: technicalAssessment || 'No technical assessment available',
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze developer profile`);
    }
  }
}
