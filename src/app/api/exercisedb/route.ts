import { NextResponse } from 'next/server';

const API_HOST = 'exercisedb.p.rapidapi.com';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || 'exercises';
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';
  
  const apiKey = process.env.RAPIDAPI_EXERCISEDB_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://${API_HOST}/${endpoint}?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': API_HOST,
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch from ExerciseDB' },
      { status: 500 }
    );
  }
}
