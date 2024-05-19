const PLATFORM = "DeviantArt";
const URL_HOME = "https://www.deviantart.com/";

var config = {};

source.enable = function (conf, settings, savedState) {
  config = conf ?? {};
}

source.getHome = function () {
  const results = getHomeResults();
  return new HomePager(results.posts, hasMore(results));
};

class HomePager extends ContentPager {
  constructor(initialResults, hasMore, nextUrl) {
    super(initialResults, hasMore);
    this.nextUrl = nextUrl;
  }

  nextPage() {
    const results = getHomeResults(this.nextUrl);
    this.results = results.posts;
    this.nextUrl = results.nextUrl;
    this.hasMore = hasMore(results);
    return this;
  }
}

function hasMore(results) {
  return results.nextUrl !== undefined
      && results.nextUrl !== null
}

function getHomeResults(url) {
  if (!url) {
    url = URL_HOME;
  }
  const homeResp = http.GET(url, {}, false);
  if (!homeResp.isOk) {
    throw new UnavailableException(`Failed to get home [${homeResp.code}]`);
  }
  const dom = domParser.parseFromString(homeResp.body);
  const main = dom.getElementsByTagName("main")[0];
  const content = main.children[2].children[0].children[0];

  const nextLink = content.children[1].getElementsByTagName("a")[0];
  const nextUrl = nextLink ? nextLink.href : null;

  const rows = content.children[0].children[0].children[0].children;
  return {
    posts: [...rows].flatMap(row => {
      const posts = row.children[0].children;
      return [...posts].map(post => getPlatformPost(post.children[0]));
    }),
    nextUrl: nextUrl
  };
}

function getPlatformPost(post) {
  const postElements = post.children;
  const postSummary = postElements[postElements.length - 2].getAttribute("aria-label");
  if (postSummary.endsWith("visual art")) {
    return getVisualArtPlatformPost(post);
  }
  if (postSummary.endsWith("literature")) {
    return getLiteraturePlatformPost(post);
  }
  throw new ScriptException("UnsupportedPostTypeException", `Unknown post type. Child element count: ${post.children.length}`);
}

function getVisualArtPlatformPost(post) {
  const link = post.children[0];
  const metadata = post.children[1].children[2].children[2]

  const postThumbnailUrl  = link.getElementsByTagName("img")[0].getAttribute("src");
  const postName = metadata.children[0].children[0].children[0].textContent;

  const postUrl = link.getAttribute("href");
  const postId = postUrl.split("-").pop();
  const postFavorites = getPostFavorites(metadata);

  const authorData = metadata.children[0].children[1].children[0].children[0].children[0];
  const platformAuthorLink = getPlatformAuthorLink(authorData);

  return new PlatformPostDetails({
    id: new PlatformID(PLATFORM, postId, config.id),
    name: postName,
    author: platformAuthorLink,
    url: postUrl,
    thumbnails: new Thumbnails([new Thumbnail(postThumbnailUrl, 1)]),
    rating: new RatingLikes(postFavorites)
  });
}

function getLiteraturePlatformPost(post) {
  const previewText = post.children[1];
  const link = post.children[2];
  const metadata = post.children[3].children[2].children[2]

  const postName = previewText.children[2].textContent;

  const postUrl = link.getAttribute("href");
  const postId = postUrl.split("-").pop();
  const postFavorites = getPostFavorites(metadata);

  const authorData = metadata.children[0].children[0].children[0].children[0].children[0];
  const platformAuthorLink = getPlatformAuthorLink(authorData);

  return new PlatformPostDetails({
    id: new PlatformID(PLATFORM, postId, config.id),
    name: postName,
    author: platformAuthorLink,
    url: postUrl,
    rating: new RatingLikes(postFavorites)
  });
}

function getPostFavorites(metadata) {
  const postInteraction = metadata.children[1].children;
  const rawFavoritesStr = postInteraction[postInteraction.length - 1].children[1].textContent;
  const favoritesStr = rawFavoritesStr.replace("K", "000")
                                             .replace("M", "000000");
  return parseInt(favoritesStr);
}

function getPlatformAuthorLink(authorData) {
  const authorId = authorData.getAttribute("data-userid");
  const authorName = authorData.getAttribute("data-username");
  const authorUrl = authorData.getAttribute("href");
  const authorAvatar = authorData.getAttribute("data-icon");
  return new PlatformAuthorLink(
      new PlatformID(PLATFORM, authorId, config.id),
      authorName,
      authorUrl,
      authorAvatar
  );
}
