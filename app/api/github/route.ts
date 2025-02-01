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
    
    // Fetch user profile and repositories in parallel
    const [profile, repositories] = await Promise.all([
      githubService.getUserProfile(username),
      githubService.getUserRepositories(username)
    ]);

    return NextResponse.json({
      profile,
      repositories
    });
  } catch (error: any) {
    console.error('GitHub API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
}
