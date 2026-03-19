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
  return content
    .split("\n")
    .filter((line) => !/instagram\.com\/(?:p|reel|tv)\//i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden border border-border bg-card"
          >
            <iframe
              src={embedUrl}
              className="w-full border-0 pointer-events-none"
              style={{ minHeight: "480px", maxHeight: "600px" }}
              loading="lazy"
              allowTransparency
              scrolling="no"
              title="Instagram Post"
            />
          </a>
        );
      })}
    </div>
  );
}
