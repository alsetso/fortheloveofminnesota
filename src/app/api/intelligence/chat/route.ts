import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/intelligence/chat
 * OpenAI chat completion for location intelligence
 * Simple, single-use requests with no storage
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, locationName, pinFeature } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Build system message with location context
    const systemMessage = {
      role: 'system' as const,
      content: `You are a helpful location intelligence assistant for Minnesota. You provide concise, accurate information about locations and places. ${locationName ? `The user is asking about: ${locationName}.` : ''}${pinFeature ? ` This is a ${pinFeature.type}${pinFeature.name ? ` named "${pinFeature.name}"` : ''}.` : ''} Keep responses brief and informative.`,
    };

    // Prepare messages for OpenAI (system message + conversation messages)
    const openAIMessages = [
      systemMessage,
      ...messages.filter((msg: any) => msg.role === 'user' || msg.role === 'assistant').map((msg: any) => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      })),
    ];

    // Call OpenAI API with gpt-4o-mini (cheaper and better than gpt-3.5-turbo)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAIMessages,
        temperature: 0.7,
        max_tokens: 500, // Limit tokens to keep costs low
      }),
    });

    if (!response.ok) {
      // Try to get error details
      let errorData: any = {};
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch (e) {
          // If JSON parsing fails, get text
          const text = await response.text();
          errorData = { message: text, status: response.status, statusText: response.statusText };
        }
      } else {
        // Not JSON, get text
        const text = await response.text();
        errorData = { message: text, status: response.status, statusText: response.statusText };
      }
      
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to get AI response', 
          details: errorData,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error('Intelligence chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}






