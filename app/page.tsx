'use client';

import { useState } from "react";
import Image from "next/image";
import { DeveloperProfile, GithubUserData, Repository } from "./services/github";
import { DeveloperAnalysis } from "./services/openai";
import ReactMarkdown from 'react-markdown';

interface AnalysisResponse {
  profile: DeveloperProfile;
  analysis: DeveloperAnalysis;
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const TIMEOUT_DURATION = 40000; // 40 seconds in milliseconds

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate username format
    const usernamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    if (!usernamePattern.test(username)) {
      setError('Please enter a valid GitHub username');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      // Create an AbortController for the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

      try {
        const response = await fetch('/api/analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error);
        }
        
        setData(result);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error(
            'The request is taking longer than usual due to high traffic. ' +
            'Please try again in a few minutes. If the problem persists, ' +
            'you can try analyzing a different profile or come back later.'
          );
        }
        throw err;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;

    const isRateLimit = error.toLowerCase().includes('rate limit exceeded');
    const isTimeout = error.toLowerCase().includes('taking longer than usual');
    let title = 'Error';
    
    if (isRateLimit) {
      title = 'Rate Limit Exceeded';
    } else if (isTimeout) {
      title = 'Request Timeout';
    }
    
    return (
      <div className="mt-4 p-6 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          {title}
        </h3>
        <p className="text-red-700 whitespace-pre-wrap">{error}</p>
        {isRateLimit && (
          <div className="mt-4">
            <p className="text-sm text-red-600 font-medium">
              To get higher rate limits:
            </p>
            <ol className="list-decimal list-inside mt-2 text-sm text-red-600 space-y-1">
              <li>Create a GitHub personal access token at{' '}
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline hover:text-red-800"
                >
                  github.com/settings/tokens
                </a>
              </li>
              <li>Add the token to your .env.local file:
                <pre className="mt-1 ml-4 p-2 bg-red-100 rounded text-red-700 font-mono text-xs">
                  GITHUB_ACCESS_TOKEN=your_token_here
                </pre>
              </li>
              <li>Restart the development server</li>
            </ol>
          </div>
        )}
        {isTimeout && (
          <div className="mt-4">
            <p className="text-sm text-red-600">
              Tips to resolve this issue:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-red-600 space-y-1">
              <li>Try analyzing a profile with fewer repositories</li>
              <li>Try again during off-peak hours</li>
              <li>Check if GitHub or OpenAI services are experiencing any outages</li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-bold text-center mb-2 text-balance">
          GitMentor
        </h1>
        <p className="text-gray-600 text-center mb-8 text-balance">
          Get personalized feedback and growth insights for your GitHub profile
        </p>
        
        <div className="card">
          <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="Enter GitHub username"
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                pattern="[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}"
                title="Please enter a valid GitHub username"
                required
                autoCapitalize="none"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className={`px-6 py-2 rounded-md text-white font-medium ${
                  loading || !username.trim()
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
          </form>

          {renderError()}
          {loading && (
            <div className="mt-8 space-y-6 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-gray-200 rounded"></div>
                  <div className="h-3 w-60 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-md"></div>
                ))}
              </div>
            </div>
          )}

          {data && (
            <div className="mt-8 space-y-8">
              {/* Profile Section */}
              <div className="flex items-center space-x-4">
                <Image
                  src={data.profile.user.avatarUrl}
                  alt={data.profile.user.username}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
                <div>
                  <h2 className="text-xl font-semibold">{data.profile.user.name || data.profile.user.username}</h2>
                  {data.profile.user.bio && <p className="text-gray-600">{data.profile.user.bio}</p>}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="text-2xl font-bold">{data.profile.user.publicRepos}</div>
                  <div className="text-gray-600">Repositories</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="text-2xl font-bold">{data.profile.user.followers}</div>
                  <div className="text-gray-600">Followers</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="text-2xl font-bold">{data.profile.user.following}</div>
                  <div className="text-gray-600">Following</div>
                </div>
              </div>

              {/* Language Stats */}
              <div className="p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Language Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(data.profile.languageStats).map(([language, bytes]) => {
                    const percentage = (bytes / Object.values(data.profile.languageStats).reduce((a, b) => a + b, 0) * 100).toFixed(1);
                    return (
                      <div key={language} className="flex items-center">
                        <span className="w-24 text-sm">{language}</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-16 text-sm text-right">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Analysis Section */}
              <div className="space-y-6">
                <div className="p-6 bg-green-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-green-800">Key Strengths</h3>
                  <ul className="space-y-2 text-green-700">
                    {data.analysis.strengths.map((strength, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{strength}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-yellow-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-yellow-800">Areas for Improvement</h3>
                  <ul className="space-y-2 text-yellow-700">
                    {data.analysis.areasForImprovement.map((area, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{area}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Recommendations</h3>
                  <ul className="space-y-2 text-blue-700">
                    {data.analysis.recommendations.map((recommendation, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{recommendation}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Technical Assessment</h3>
                  <div className="text-gray-700 markdown-content">
                    <ReactMarkdown>{data.analysis.technicalAssessment}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Top Repositories */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Top Repositories</h3>
                <div className="space-y-4">
                  {data.profile.repositories.map((repo) => (
                    <div key={repo.name} className="p-4 border rounded-md">
                      <h4 className="font-medium">{repo.name}</h4>
                      {repo.description && (
                        <p className="text-gray-600 text-sm mt-1">{repo.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                        {repo.language && (
                          <span className="px-2 py-1 bg-gray-100 rounded-md">{repo.language}</span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 rounded-md">⭐ {repo.stargazersCount}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-md">🍴 {repo.forksCount}</span>
                      </div>
                      {repo.topics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {repo.topics.map((topic) => (
                            <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md">
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
