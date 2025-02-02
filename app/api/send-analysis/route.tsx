import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import markdownit from 'markdown-it';

const resend = new Resend(process.env.RESEND_API_KEY);
const md = new markdownit();

async function generateAnalysisHTML(analysis: any, profile: any): Promise<string> {
  // Validate input data
  if (!analysis || !profile) {
    throw new Error('Missing required data for analysis');
  }

  // Validate required fields in analysis
  if (!analysis.strengths || !analysis.areasForImprovement || 
      !analysis.recommendations || !analysis.technicalAssessment) {
    throw new Error('Analysis data is missing required fields');
  }

  // Validate required fields in profile
  if (!profile.user || !profile.repositories) {
    throw new Error('Profile data is missing required fields');
  }

  // Generate markdown content
  const markdown = `
# GitHub Profile Analysis

## Technical Assessment
${analysis.technicalAssessment}

## Strengths
${analysis.strengths.map((strength: string) => `- ${strength}`).join('\n')}

## Areas for Improvement
${analysis.areasForImprovement.map((area: string) => `- ${area}`).join('\n')}

## Recommendations
${analysis.recommendations.map((rec: string) => `- ${rec}`).join('\n')}
`;

  // Convert markdown to HTML with some basic styling
  const htmlContent = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2, h3 {
            color: #2c3e50;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        ${md.render(markdown)}
      </body>
    </html>
  `;

  return htmlContent;
}

export async function POST(request: Request) {
  try {
    console.log('Starting analysis email send process');
    
    // Parse request body with error handling
    let email, analysis, profile;
    try {
      const body = await request.json();
      email = body.email;
      analysis = body.analysis;
      profile = body.profile;
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new NextResponse(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Received data:', { email, hasAnalysis: !!analysis, hasProfile: !!profile });

    // Validate required fields
    if (!email || !analysis || !profile) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!analysis) missingFields.push('analysis');
      if (!profile) missingFields.push('profile');
      
      console.log(`Missing required fields: ${missingFields.join(', ')}`);
      return new NextResponse(JSON.stringify({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate HTML content
    console.log('Generating HTML content...');
    const htmlContent = await generateAnalysisHTML(analysis, profile);
    console.log('HTML content generated successfully');

    // Send email
    console.log('Sending email...');
    const data = await resend.emails.send({
      from: 'GitMentor <analysis@gitmentor.srecraft.io>',
      to: [email],
      subject: 'Your GitHub Profile Analysis',
      html: htmlContent,
    });

    console.log('Email sent successfully:', data);
    return new NextResponse(JSON.stringify({ message: 'Analysis sent successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in POST handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ 
      error: 'Failed to process request',
      details: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
