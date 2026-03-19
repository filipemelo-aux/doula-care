import { ExternalLink } from "lucide-react";

const INSTAGRAM_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?/g;

interface InstagramLinkPreviewProps {
  content: string;
}

export function extractInstagramUrls(content: string): string[] {
  const matches = content.match(INSTAGRAM_REGEX);
  return matches ? [...new Set(matches)] : [];
}

export function removeInstagramMarkdownLinks(content: string): string {
  // Remove markdown links like [text](instagram-url) 
  return content.replace(/📸\s*\[.*?\]\(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?\)/g, "").trim();
}

export function InstagramLinkPreview({ content }: InstagramLinkPreviewProps) {
  const urls = extractInstagramUrls(content);
  if (urls.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {urls.map((url) => {
        const postId = url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1];
        const embedUrl = `https://www.instagram.com/p/${postId}/embed/`;
        
        return (
          <div key={url} className="rounded-xl overflow-hidden border border-border bg-card">
            <iframe
              src={embedUrl}
              className="w-full border-0"
              style={{ minHeight: "480px", maxHeight: "600px" }}
              loading="lazy"
              allowTransparency
              scrolling="no"
              title="Instagram Post"
            />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors border-t border-border"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver no Instagram
            </a>
          </div>
        );
      })}
    </div>
  );
}
