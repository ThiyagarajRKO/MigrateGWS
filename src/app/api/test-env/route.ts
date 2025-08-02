import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const envVars = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'missing',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'present' : 'missing',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'present' : 'missing',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'present' : 'missing',
  }

  return NextResponse.json(envVars)
}
