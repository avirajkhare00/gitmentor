'use client';

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from 'next/navigation';
import { DeveloperProfile, GithubUserData, Repository } from "./services/github";
import { DeveloperAnalysis } from "./services/openai";
import ReactMarkdown from 'react-markdown';
import { useAnalytics } from './hooks/useAnalytics';
import toast, { Toaster } from 'react-hot-toast';
import { RateLimitError } from './components/RateLimitError';

interface AnalysisResponse {
  profile: DeveloperProfile;
  analysis: DeveloperAnalysis;
}

function EmailAnalysisButton({ analysis, profile }: { analysis: Partial<DeveloperAnalysis>, profile: DeveloperProfile | null }) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const sendAnalysis = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    if (!analysis || !profile) {
      toast.error("Analysis data is not ready");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/send-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          analysis,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send analysis');
      }

      toast.success("Analysis sent to your email!");
      setEmail("");
    } catch (error) {
      console.error('Error sending analysis:', error);
      toast.error("Failed to send analysis. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Get Your Analysis Report</h3>
      <p className="text-gray-600 mb-4">
        Enter your email address to receive a detailed analysis of your GitHub profile.
      </p>
      <div className="flex flex-col space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSending}
        />
        <button
          onClick={sendAnalysis}
          disabled={isSending}
          className={`px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSending ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isSending ? 'Sending...' : 'Send Analysis'}
        </button>
      </div>
    </div>
  );
}

function ProfileAnalysis() {
  const { trackEvent } = useAnalytics();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    user: false,
    repos: false,
    analysis: {
      strengths: false,
      areasForImprovement: false,
      recommendations: false,
      technicalAssessment: false
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<GithubUserData | null>(null);
  const [reposData, setReposData] = useState<Repository[] | null>(null);
  const [analysis, setAnalysis] = useState<Partial<DeveloperAnalysis>>({});

  const submitProfile = async (username: string) => {
    setError(null);
    try {
      const userData = await fetchUserData(username);
      if (!userData) return;
      
      const repos = await fetchRepos(username);
      if (!repos) return;

      // Calculate language statistics from repositories
      const languageStats: { [key: string]: number } = {};
      repos.forEach((repo: Repository) => {
        if (repo.language) {
          languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
        }
      });

      const profile: DeveloperProfile = {
        user: userData,
        repositories: repos,
        languageStats
      };

      await fetchAnalysis(profile);
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
      setError(error.message);
    }
  };

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

  const fetchRepos = async (username: string) => {
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
    // Set all analysis sections to loading
    setLoadingStates(prev => ({
      ...prev,
      analysis: {
        strengths: true,
        areasForImprovement: true,
        recommendations: true,
        technicalAssessment: true
      }
    }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const data = await response.json();
      
      // Reset loading states for analysis
      setLoadingStates(prev => ({
        ...prev,
        analysis: {
          strengths: false,
          areasForImprovement: false,
          recommendations: false,
          technicalAssessment: false
        }
      }));

      // Make sure we have the correct structure for the analysis data
      const analysisData = {
        strengths: data.analysis?.strengths || [],
        areasForImprovement: data.analysis?.areasForImprovement || [],
        recommendations: data.analysis?.recommendations || [],
        technicalAssessment: data.analysis?.technicalAssessment || '',
        profileRating: data.analysis?.profileRating || null
      };
      
      setAnalysis(analysisData);

      // Store analysis and profile data in localStorage
      localStorage.setItem('analysisData', JSON.stringify(analysisData));
      localStorage.setItem('profileData', JSON.stringify(profile));

      return analysisData;
    } catch (error: any) {
      console.error('Error during analysis:', error);
      toast.error(error.message || 'Failed to analyze profile');
      setLoadingStates(prev => ({
        ...prev,
        analysis: {
          strengths: false,
          areasForImprovement: false,
          recommendations: false,
          technicalAssessment: false
        }
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset states
    setError(null);
    setUserData(null);
    setReposData(null);
    setAnalysis({});

    try {
      // Step 1: Fetch user data
      const user = await fetchUserData(username);
      if (!user) return;

      // Step 2: Fetch repositories
      const repositories = await fetchRepos(username);
      if (!repositories) return;

      // Step 3: Calculate language statistics
      const languageStats = repositories.reduce((acc: Record<string, number>, repo: Repository) => {
        Object.entries(repo.languages).forEach(([lang, bytes]) => {
          acc[lang] = (acc[lang] || 0) + bytes;
        });
        return acc;
      }, {} as Record<string, number>);

      // Step 4: Start analysis
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
        {isRateLimit && <RateLimitError />}
        {isTimeout && (
          <div className="mt-4">
            <p className="text-sm text-red-600">
              Tips to resolve this issue:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-red-600 space-y-1">
              <li>Try analyzing a profile with fewer repositories</li>
              <li>Try again during off-peak hours</li>
              <li>Take screenshot and share with @avirajkhare00 on Twitter</li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  const PaymentSection = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [sendInsights, setSendInsights] = useState(false);
    const { trackEvent } = useAnalytics();

    const handlePayment = async () => {
      try {
        if (sendInsights && !email) {
          toast.error('Please enter your email to receive insights');
          return;
        }

        trackEvent({
          action: 'payment_initiated',
          category: 'payment'
        });
        setLoading(true);
        const response = await fetch('/api/create-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: sendInsights ? email : null,
            sendInsights,
          }),
        });
        
        const { sessionId } = await response.json();
        // Removed Stripe import
        
        if (sessionId) {
          // Removed Stripe redirect
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="flex justify-center w-full">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 mt-8">
          <h2 className="text-2xl font-bold text-center mb-6">Mail me as PDF</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600">Email Report</span>
              <span className="font-semibold">$2.00</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Get comprehensive insights about your developer profile delivered to your inbox.
            </p>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendInsights"
                  checked={sendInsights}
                  onChange={(e) => setSendInsights(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="sendInsights" className="ml-2 text-sm text-gray-600">
                  Send insights to my email
                </label>
              </div>

              {sendInsights && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              )}
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } transition-colors`}
          >
            {loading ? 'Processing...' : 'Get Insights for $2.00'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-16 px-4">
      <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 text-balance">
        GitMentor
      </h1>
      <p className="text-gray-600 text-center mb-6 sm:mb-8 text-balance text-sm sm:text-base">
        Get personalized feedback and growth insights for your GitHub profile
      </p>
      
      <div className="card">
        <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              placeholder="Enter GitHub username"
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
              autoCapitalize="none"
              autoComplete="off"
              spellCheck="false"
              inputMode="text"
            />
            <button
              type="submit"
              disabled={loadingStates.user || loadingStates.repos || loadingStates.analysis.strengths || loadingStates.analysis.areasForImprovement || loadingStates.analysis.recommendations || loadingStates.analysis.technicalAssessment || !username.trim()}
              className={`w-full sm:w-auto px-6 py-3 rounded-md text-white font-medium ${
                loadingStates.user || loadingStates.repos || loadingStates.analysis.strengths || loadingStates.analysis.areasForImprovement || loadingStates.analysis.recommendations || loadingStates.analysis.technicalAssessment || !username.trim()
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loadingStates.user || loadingStates.repos || loadingStates.analysis.strengths || loadingStates.analysis.areasForImprovement || loadingStates.analysis.recommendations || loadingStates.analysis.technicalAssessment ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Image
                  src={userData.avatarUrl}
                  alt={userData.username}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">{userData.name || userData.username}</h2>
                  {userData.bio && <p className="text-sm sm:text-base text-gray-600">{userData.bio}</p>}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="w-full sm:w-auto px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center justify-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share Profile</span>
              </button>
            </div>

            {analysis?.profileRating && (
                <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Profile Rating</h3>
                    <div className="flex items-center">
                      <span className="text-2xl font-bold text-blue-600">{analysis.profileRating.score.toFixed(1)}</span>
                      <span className="text-gray-500 ml-1">/10</span>
                    </div>
                  </div>
                  {/* <p className="text-gray-600">
                    <ReactMarkdown>{analysis.profileRating.explanation}</ReactMarkdown>
                  </p> */}
                </div>
              )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-gray-50 rounded-md text-center">
                <div className="text-xl sm:text-2xl font-bold">{userData.publicRepos}</div>
                <div className="text-sm sm:text-base text-gray-600">Repositories</div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-md text-center">
                <div className="text-xl sm:text-2xl font-bold">{userData.followers}</div>
                <div className="text-sm sm:text-base text-gray-600">Followers</div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-md text-center">
                <div className="text-xl sm:text-2xl font-bold">{userData.following}</div>
                <div className="text-sm sm:text-base text-gray-600">Following</div>
              </div>
            </div>
            {/* Analysis Section */}
            <div className="space-y-6">
              {/* Key Strengths Section */}
              {loadingStates.analysis.strengths ? (
                <div className="p-4 sm:p-6 bg-green-50/50 rounded-lg animate-pulse">
                  <div className="h-6 w-32 bg-green-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-green-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-green-100 rounded"></div>
                    <div className="h-4 w-4/6 bg-green-100 rounded"></div>
                  </div>
                </div>
              ) : analysis.strengths && (
                <div className="p-4 sm:p-6 bg-green-50 rounded-lg animate-fade-in">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-green-800">Key Strengths</h3>
                  <ul className="space-y-2 text-green-700 text-sm sm:text-base">
                    {analysis.strengths?.map((strength, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{strength}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for Improvement Section */}
              {loadingStates.analysis.areasForImprovement ? (
                <div className="p-4 sm:p-6 bg-yellow-50/50 rounded-lg animate-pulse">
                  <div className="h-6 w-48 bg-yellow-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-yellow-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-yellow-100 rounded"></div>
                    <div className="h-4 w-4/6 bg-yellow-100 rounded"></div>
                  </div>
                </div>
              ) : analysis.areasForImprovement && (
                <div className="p-4 sm:p-6 bg-yellow-50 rounded-lg animate-fade-in">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-yellow-800">Areas for Improvement</h3>
                  <ul className="space-y-2 text-yellow-700 text-sm sm:text-base">
                    {analysis.areasForImprovement?.map((area, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{area}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations Section */}
              {loadingStates.analysis.recommendations ? (
                <div className="p-4 sm:p-6 bg-blue-50/50 rounded-lg animate-pulse">
                  <div className="h-6 w-40 bg-blue-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-blue-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-blue-100 rounded"></div>
                    <div className="h-4 w-4/6 bg-blue-100 rounded"></div>
                  </div>
                </div>
              ) : analysis.recommendations && (
                <div className="p-4 sm:p-6 bg-blue-50 rounded-lg animate-fade-in">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-blue-800">Recommendations</h3>
                  <ul className="space-y-2 text-blue-700 text-sm sm:text-base">
                    {analysis.recommendations?.map((recommendation, index) => (
                      <li key={index} className="markdown-content">
                        <ReactMarkdown>{recommendation}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technical Assessment Section */}
              {loadingStates.analysis.technicalAssessment ? (
                <div className="p-4 sm:p-6 bg-gray-50/50 rounded-lg animate-pulse">
                  <div className="h-6 w-44 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-gray-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
                    <div className="h-4 w-4/6 bg-gray-100 rounded"></div>
                  </div>
                </div>
              ) : analysis.technicalAssessment && (
                <div className="p-4 sm:p-6 bg-gray-50 rounded-lg animate-fade-in">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Technical Assessment</h3>
                  <div className="text-gray-700 markdown-content">
                    <ReactMarkdown>{analysis.technicalAssessment}</ReactMarkdown>
                  </div>
                </div>
              )}
              {/* Payment Section */}
              {(analysis.strengths || analysis.areasForImprovement || analysis.recommendations || analysis.technicalAssessment) &&
                <EmailAnalysisButton 
                  analysis={analysis} 
                  profile={userData && reposData ? {
                    user: userData,
                    repositories: reposData,
                    languageStats: reposData.reduce((stats, repo) => {
                      Object.entries(repo.languages).forEach(([lang, bytes]) => {
                        stats[lang] = (stats[lang] || 0) + bytes;
                      });
                      return stats;
                    }, {} as { [key: string]: number })
                  } : null} 
                />
              }
            </div>

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
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{repo.name}</h4>
                          {repo.description && (
                            <p className="text-gray-600 text-sm mt-1">{repo.description}</p>
                          )}
                        </div>
                        {repo.isFork && repo.parentRepository && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            Forked from{' '}
                            <a 
                              href={repo.parentRepository.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {repo.parentRepository.fullName}
                            </a>
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                        {repo.language && (
                          <span className="px-2 py-1 bg-gray-100 rounded-md">{repo.language}</span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 rounded-md">⭐ {repo.stargazersCount}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded-md">🍴 {repo.forksCount}</span>
                        {repo.isFork && repo.hasContributions && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md">
                            {repo.contributionsCount} contribution{repo.contributionsCount !== 1 ? 's' : ''}
                          </span>
                        )}
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
    <main className="flex min-h-screen flex-col items-center p-12">
      <div className="max-w-5xl w-full">
        <div className="flex flex-col items-center justify-center w-full">
          <Suspense fallback={<div>Loading...</div>}>
            <ProfileAnalysis />
          </Suspense>
        </div>
      </div>

      <Toaster position="bottom-right" />
    </main>
  );
}
