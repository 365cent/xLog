import type { Transformer } from "../rehype-embed"
import { BilibiliTransformer } from "./Bilibili"
import { CodeSandboxTransformer } from "./CodeSandBox"
import { GitHubRepoTransformer } from "./GitHub"
import { NetEaseMusicTransformer } from "./NetEaseMusic"
import { SpotifyTransformer } from "./Spotify"
import { YouTubeTransformer } from "./YouTube"

export const transformers: Transformer[] = [
  CodeSandboxTransformer,
  GitHubRepoTransformer,
  YouTubeTransformer,
  NetEaseMusicTransformer,
  BilibiliTransformer,
  SpotifyTransformer,
]
