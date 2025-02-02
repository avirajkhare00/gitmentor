import { NextResponse } from 'next/server';
import { OpenAIService } from '@/app/services/openai';

export async function POST(request: Request) {
  try {
    const { profile } = await request.json();
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile data is required' },
        { status: 400 }
      );
    }

    const openaiService = new OpenAIService();
    
    try {
      // Analyze the profile
      const analysis = await openaiService.analyzeDeveloperProfile(profile);

      return NextResponse.json({
        analysis,
      });
    } catch (error: any) {
      // Forward the exact error message
      return NextResponse.json(
        { error: error.message || 'Failed to analyze profile' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }
}
