import { NextResponse } from 'next/server';
import { GithubService } from '@/app/services/github';

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
    
    try {
      const user = await githubService.getUserProfile(username);
      
      // Log GitHub user data
      console.log('[GitMentor API] GitHub User Request:', {
        timestamp: new Date().toISOString(),
        username: user.username,
        name: user.name,
        publicRepos: user.publicRepos,
        followers: user.followers,
        following: user.following,
        createdAt: user.createdAt,
        requestUrl: request.url
      });

      return NextResponse.json({ user });
    } catch (error: any) {
      // Log error
      console.error('[GitMentor API] GitHub User Error:', {
        timestamp: new Date().toISOString(),
        username,
        error: error.message,
        requestUrl: request.url
      });

      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('rate limit exceeded') ? 429 : 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
