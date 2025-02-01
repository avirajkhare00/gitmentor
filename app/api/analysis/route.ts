import { NextResponse } from 'next/server';
import { GithubService } from '@/app/services/github';
import { OpenAIService } from '@/app/services/openai';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    
    if (!username) {
      return NextResponse.json(
        { error: 'GitHub username is required' },
        { status: 400 }
      );
    }

    const githubService = new GithubService();
    const openaiService = new OpenAIService();
    
    try {
      // Get detailed profile data
      const profile = await githubService.getDeveloperProfile(username);
      
      // Analyze the profile
      const analysis = await openaiService.analyzeDeveloperProfile(profile);

      return NextResponse.json({
        profile,
        analysis,
      });
    } catch (error: any) {
      // Forward the exact error message from GitHub service
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('rate limit exceeded') ? 429 : 500 }
      );
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
