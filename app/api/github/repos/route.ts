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
      const repositories = await githubService.getUserRepositories(username);
      return NextResponse.json({ repositories });
    } catch (error: any) {
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
