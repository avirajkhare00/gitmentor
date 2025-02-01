declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY: string;
    GITHUB_ACCESS_TOKEN?: string;
  }
}
