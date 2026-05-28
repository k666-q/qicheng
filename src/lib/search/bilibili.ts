/**
 * B站视频搜索
 * 使用 B站公开搜索 API 获取真实视频链接
 */

export type BiliSearchResult = {
  title: string;
  url: string;
  author: string;
  play: number;
  duration: string;
  description: string;
};

export async function searchBilibili(keyword: string, limit = 5): Promise<BiliSearchResult[]> {
  try {
    const encoded = encodeURIComponent(keyword);
    const res = await fetch(
      `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encoded}&page=1&page_size=${limit}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.bilibili.com",
        },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const results = data?.data?.result;

    if (!Array.isArray(results)) return [];

    return results.slice(0, limit).map((item: {
      title: string;
      bvid: string;
      author: string;
      play: number;
      duration: string;
      description: string;
    }) => ({
      title: item.title.replace(/<[^>]+>/g, ""),
      url: `https://www.bilibili.com/video/${item.bvid}`,
      author: item.author,
      play: item.play,
      duration: item.duration,
      description: item.description?.slice(0, 100) || "",
    }));
  } catch {
    return [];
  }
}

export function formatSearchResults(results: BiliSearchResult[]): string {
  if (results.length === 0) return "未找到相关视频";
  return results.map((r, i) =>
    `${i + 1}. 「${r.title}」by ${r.author}（${r.play}播放，${r.duration}）\n   链接：${r.url}\n   简介：${r.description}`
  ).join("\n\n");
}
