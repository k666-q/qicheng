/**
 * B站视频搜索
 * 使用 B站公开搜索接口获取真实视频链接
 */

export type BiliSearchResult = {
  title: string;
  url: string;
  author: string;
  play: number;
  duration: string;
  description: string;
};

export async function searchBilibili(keyword: string, limit = 8): Promise<BiliSearchResult[]> {
  // 尝试多种方法获取搜索结果
  const results = await searchViaWbi(keyword, limit);
  if (results.length > 0) return results;

  // 降级：使用热门视频搜索
  return await searchViaHot(keyword, limit);
}

async function searchViaWbi(keyword: string, limit: number): Promise<BiliSearchResult[]> {
  try {
    const encoded = encodeURIComponent(keyword);
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&keyword=${encoded}&page=1&page_size=${limit}&order=totalrank&duration=0&tids=0&__refresh__=true&_extra=&context=&page_size=${limit}&from_source=&from_spmid=&platform=pc&highlight=1&single_column=0&dynamic_offset=0&ts=${timestamp}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://search.bilibili.com",
          "Origin": "https://search.bilibili.com",
          "Cookie": "buvid3=placeholder",
        },
        signal: AbortSignal.timeout(5000),
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
      play: item.play || 0,
      duration: item.duration || "",
      description: item.description?.slice(0, 100) || "",
    }));
  } catch {
    return [];
  }
}

async function searchViaHot(keyword: string, limit: number): Promise<BiliSearchResult[]> {
  try {
    const encoded = encodeURIComponent(keyword);
    const res = await fetch(
      `https://api.bilibili.com/x/web-interface/search/all/v2?keyword=${encoded}&page=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.bilibili.com",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const resultGroups = data?.data?.result;

    if (!Array.isArray(resultGroups)) return [];

    const videoGroup = resultGroups.find((g: { result_type: string }) => g.result_type === "video");
    if (!videoGroup || !Array.isArray(videoGroup.data)) return [];

    return videoGroup.data.slice(0, limit).map((item: {
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
      play: item.play || 0,
      duration: item.duration || "",
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
