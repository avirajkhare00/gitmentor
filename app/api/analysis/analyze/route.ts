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
        const data = `data: ${JSON.stringify(update)}\n\n`;
        await writer.write(encoder.encode(data));
      } catch (error) {
        console.error('Error writing to stream:', error);
      }
    }).then(async (finalAnalysis) => {
      // Send the final complete analysis
      const data = `data: ${JSON.stringify({ complete: true, analysis: finalAnalysis })}\n\n`;
      await writer.write(encoder.encode(data));
      await writer.close();
    }).catch(async (error) => {
      const data = `data: ${JSON.stringify({ error: error.message })}\n\n`;
      await writer.write(encoder.encode(data));
      await writer.close();
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
