import { NextResponse } from 'next/server';
import { OpenAIService } from '@/app/services/openai';
import { DeveloperProfile } from '@/app/services/github';

export async function POST(request: Request) {
  try {
    const { profile } = await request.json();
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Developer profile is required' },
        { status: 400 }
      );
    }

    // Log analysis request
    console.log('[GitMentor API] Analysis Started:', {
      timestamp: new Date().toISOString(),
      username: profile.user.username,
      repositoryCount: profile.repositories.length,
      languages: Object.keys(profile.languageStats),
      totalRepos: profile.user.publicRepos,
      requestUrl: request.url
    });

    const openaiService = new OpenAIService();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Create a response with the stream
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    // Start the analysis process
    openaiService.analyzeDeveloperProfile(profile, async (update) => {
      try {
        // Log each section completion
        if (update.section) {
          console.log('[GitMentor API] Analysis Section Completed:', {
            timestamp: new Date().toISOString(),
            username: profile.user.username,
            section: update.section,
            requestUrl: request.url
          });
        }

        // Format data as SSE
        const data = encoder.encode(`data: ${JSON.stringify(update)}\n\n`);
        await writer.write(data);
      } catch (error: unknown) {
        console.error('[GitMentor API] Analysis Stream Error:', {
          timestamp: new Date().toISOString(),
          username: profile.user.username,
          error: error instanceof Error ? error.message : String(error),
          requestUrl: request.url
        });
      }
    }).then(async () => {
      // Log analysis completion
      console.log('[GitMentor API] Analysis Completed:', {
        timestamp: new Date().toISOString(),
        username: profile.user.username,
        repositoryCount: profile.repositories.length,
        languages: Object.keys(profile.languageStats),
        requestUrl: request.url
      });
      
      await writer.close();
    }).catch(async (error: unknown) => {
      console.error('[GitMentor API] Analysis Failed:', {
        timestamp: new Date().toISOString(),
        username: profile.user.username,
        error: error instanceof Error ? error.message : String(error),
        requestUrl: request.url
      });
      
      await writer.close();
    });

    return response;
  } catch (error: unknown) {
    console.error('[GitMentor API] Analysis Request Error:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      requestUrl: request.url
    });
    
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
