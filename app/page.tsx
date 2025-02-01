'use client';

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from 'next/navigation';
import { DeveloperProfile, GithubUserData, Repository } from "./services/github";
import { DeveloperAnalysis } from "./services/openai";
import ReactMarkdown from 'react-markdown';
import { useAnalytics } from './hooks/useAnalytics';
import toast, { Toaster } from 'react-hot-toast';

interface AnalysisResponse {
  profile: DeveloperProfile;
  analysis: DeveloperAnalysis;
}

function ProfileAnalysis() {
  const { trackEvent } = useAnalytics();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    user: false,
    repos: false,
    analysis: false
  });
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<GithubUserData | null>(null);
  const [reposData, setReposData] = useState<Repository[] | null>(null);
  const [analysisData, setAnalysisData] = useState<DeveloperAnalysis | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      const profileParam = searchParams.get('profile');
      if (profileParam) {
        const trimmedUsername = profileParam.trim();
        if (trimmedUsername) {
          setUsername(trimmedUsername);
          setIsInitialized(true);
          submitProfile(trimmedUsername);
        }
      }
      setIsInitialized(true);
    }
  }, [searchParams, isInitialized]);

  const fetchUserData = async (username: string) => {
    setLoadingStates(prev => ({ ...prev, user: true }));
    try {
      trackEvent({
        action: 'fetch_user_data',
        category: 'API',
        label: username
      });

      const response = await fetch('/api/github/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      
      const { user } = await response.json();
      setUserData(user);
      return user;
    } catch (error: any) {
      trackEvent({
        action: 'error',
        category: 'API',
        label: error.message
      });
      setError(error.message);
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, user: false }));
    }
  };

  const fetchReposData = async (username: string) => {
    setLoadingStates(prev => ({ ...prev, repos: true }));
    try {
      trackEvent({
        action: 'fetch_repos_data',
        category: 'API',
        label: username
      });

      const response = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      
      const { repositories } = await response.json();
      setReposData(repositories);
      return repositories;
    } catch (error: any) {
      trackEvent({
        action: 'error',
        category: 'API',
        label: error.message
      });
      setError(error.message);
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, repos: false }));
    }
  };

  const fetchAnalysis = async (profile: DeveloperProfile) => {
    setLoadingStates(prev => ({ ...prev, analysis: true }));
    try {
      trackEvent({
        action: 'fetch_analysis',
        category: 'API',
        label: profile.user.username
      });

      const response = await fetch('/api/analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      
      const { analysis } = await response.json();
      setAnalysisData(analysis);
    } catch (error: any) {
      trackEvent({
        action: 'error',
        category: 'API',
        label: error.message
      });
      setError(error.message);
    } finally {
      setLoadingStates(prev => ({ ...prev, analysis: false }));
    }
  };

  const submitProfile = async (profileUsername: string) => {
    if (!profileUsername.trim()) {
      setError("GitHub username is required");
      return;
    }
    
    setError(null);
    setUserData(null);
    setReposData(null);
    setAnalysisData(null);

    try {
      // Step 1: Fetch user data
      const user = await fetchUserData(profileUsername);

      // Step 2: Fetch repositories
      const repositories = await fetchReposData(profileUsername);

      // Step 3: Calculate language stats
      const languageStats = repositories.reduce((stats: { [key: string]: number }, repo: Repository) => {
        Object.entries(repo.languages).forEach(([language, bytes]) => {
          stats[language] = (stats[language] || 0) + bytes;
        });
        return stats;
      }, {});

      // Step 4: Get analysis
      const profile: DeveloperProfile = {
        user,
        repositories,
        languageStats
      };

      await fetchAnalysis(profile);
    } catch (error) {
      // Error handling is done in individual fetch functions
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProfile(username);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/?profile=${userData?.username}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Profile URL copied to clipboard!', {
        duration: 2000,
        position: 'bottom-center',
      });
      trackEvent({
        action: 'share_profile',
        category: 'User',
        label: userData?.username
      });
    }).catch(() => {
      toast.error('Failed to copy URL to clipboard');
    });
  };

  const renderLoadingState = (section: string) => (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );

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
              required
              autoCapitalize="none"
              autoComplete="off"
              spellCheck="false"
              inputMode="text"
            />
            <button
              type="submit"
              disabled={loadingStates.user || loadingStates.repos || loadingStates.analysis || !username.trim()}
              className={`px-6 py-2 rounded-md text-white font-medium ${
                loadingStates.user || loadingStates.repos || loadingStates.analysis || !username.trim()
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loadingStates.user || loadingStates.repos || loadingStates.analysis ? (
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
        {loadingStates.user && (
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

        {userData && (
          <div className="mt-8 space-y-8">
            {/* User Profile Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Image
                  src={userData.avatarUrl}
                  alt={userData.username}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
                <div>
                  <h2 className="text-xl font-semibold">{userData.name || userData.username}</h2>
                  {userData.bio && <p className="text-gray-600">{userData.bio}</p>}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share Profile</span>
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <div className="text-2xl font-bold">{userData.publicRepos}</div>
                <div className="text-gray-600">Repositories</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-md">
                <div className="text-2xl font-bold">{userData.followers}</div>
                <div className="text-gray-600">Followers</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-md">
                <div className="text-2xl font-bold">{userData.following}</div>
                <div className="text-gray-600">Following</div>
              </div>
            </div>
            {/* Analysis Section */}
            {loadingStates.analysis ? (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Analyzing Profile...</h3>
                {renderLoadingState('analysis')}
              </div>
            ) : analysisData && (
              <div className="space-y-6">
                <div className="p-6 bg-green-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-green-800">Key Strengths</h3>
                  <ul className="space-y-2 text-green-700">
                    {analysisData.strengths.map((strength, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{strength}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-yellow-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-yellow-800">Areas for Improvement</h3>
                  <ul className="space-y-2 text-yellow-700">
                    {analysisData.areasForImprovement.map((area, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{area}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Recommendations</h3>
                  <ul className="space-y-2 text-blue-700">
                    {analysisData.recommendations.map((recommendation, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{recommendation}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Technical Assessment</h3>
                  <div className="text-gray-700 markdown-content">
                    <ReactMarkdown>{analysisData.technicalAssessment}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Repositories Section */}
            {loadingStates.repos ? (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Loading Repositories...</h3>
                {renderLoadingState('repos')}
              </div>
            ) : reposData && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Top Repositories</h3>
                <div className="space-y-4">
                  {reposData.map((repo) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <Suspense fallback={
        <div className="max-w-4xl mx-auto py-16 px-4">
          <h1 className="text-4xl font-bold text-center mb-2 text-balance">
            GitMentor
          </h1>
          <p className="text-gray-600 text-center mb-8 text-balance">
            Loading...
          </p>
        </div>
      }>
        <ProfileAnalysis />
      </Suspense>
    </main>
  );
}
