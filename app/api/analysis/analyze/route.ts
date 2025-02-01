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
    
    try {
      const analysis = await openaiService.analyzeDeveloperProfile(profile);
      return NextResponse.json({ analysis });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}
