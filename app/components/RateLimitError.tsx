import React from 'react';

export const RateLimitError: React.FC = () => {
  return (
    <div className="mt-4">
      <p className="text-sm text-red-600 font-medium">
        GitHub API rate limit exceeded
      </p>
      <p className="mt-2 text-sm text-red-600">
        Please try again later or contact{' '}
        <a
          href="https://x.com/avirajkhare00"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-red-800"
        >
          @avirajkhare00 on Twitter
        </a>{' '}
        for assistance.
      </p>
    </div>
  );
};
