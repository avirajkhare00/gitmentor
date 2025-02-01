# GitMentor

## AI based developer growth platform

### Problem Statement
Currently there is no one to give insights on how to improve a developer's profile in github.

### Solution

  - Enter github username.
  - AI agent will access github projects.
  - Suggest user how he/she can improve as a developer.

### Limitations
 - Only github is supported.
 - We judge on proof of work and not on resume/CV.
 - We will run on vercel
 - We will use openAI API for the AI agent.
 - It is going to be a free service.
 - One user is only going to generate one report.

## Setup

### GitHub Authentication (Optional)
To increase API rate limits and access private repositories:

1. Create a GitHub personal access token:
   - Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
   - Click "Generate new token"
   - Select the necessary scopes: `public_repo` (for public repositories) or `repo` (for private repositories)
   - Copy the generated token

2. Create a `.env.local` file in the project root and add your token:
   ```
   GITHUB_ACCESS_TOKEN=your_token_here
   ```

3. Restart the development server if it's running

Note: The application will work without a token but with lower API rate limits.