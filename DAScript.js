const PLATFORM = "DeviantArt";
const URL_HOME = "https://www.deviantart.com/";

var config = {};

var defaultHeaders = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.153 Mobile Safari/537.36"
};

var logStr;


source.enable = function (conf, settings, savedState) {
  config = conf ?? {};
}

source.getHome = function () {
  const results = getHomeResults();
  return new HomePager(results.posts, hasMore(results), results.nextUrl);
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
  logStr = "";
  const homeResp = http.GET(url, defaultHeaders, false);
  if (!homeResp.isOk) {
    throw new UnavailableException(`Failed to get home [${homeResp.code}]`);
  }
  log(homeResp.body, "HTTP body: ");
  const dom = domParser.parseFromString(homeResp.body);

  // log(dom, "DOM object: ");
  // log(dom.children, "DOM children: ");
  // log(dom.children?.[0], "DOM html object: ");
  // log(dom.children?.[0]?.outerHTML, "DOM html outerHTML: ");
  // log(dom.children?.[0]?.children, "DOM html children: ")
  // return logStrAsPlatformPost();

  const body = dom.getElementsByTagName("body")[0];
  const content = body.children[1].children[0].children[2].children[0].children[0];

  log(content, "Content element: ")
  log(content.children, "Content children: ")
  const nextLink = content.children[1].getElementsByTagName("a")[0];
  const nextUrl = nextLink ? nextLink.href : null;

  log(nextUrl, "Next URL: ");

  const posts = content.children[0].children[0].children;
  const platformPosts = [...posts].map(post => {
    const postElements = post.children;
    const lastElement = postElements[postElements.length - 1]
    return getPlatformPost(lastElement.children[0]);
  });
  const results = {
    posts: platformPosts,
    nextUrl: nextUrl
  };
  log(results, "Results: ");
  return results;
}

function getPlatformPost(post) {
  log(post, "Found post: ");
  log(post.children, "Post children: ");
  if (post.children[1]?.getAttribute("aria-label")?.endsWith("visual art")) {
    return getVisualArtPlatformPost(post);
  }
  if (post.children[1]?.children[3]?.getAttribute("aria-label")?.endsWith("literature")) {
    return getLiteraturePlatformPost(post);
  }
  throw new ScriptException("UnsupportedPostTypeException", `Unknown post type. Child element count: ${post.children.length}`);
}

function getVisualArtPlatformPost(post) {
  log("Found visual art post");
  const link = post.children[1];
  const postHeader = post.children[0].children[0].children[0]
  const postFooter = post.children[2].children[0]

  const postThumbnailUrl  = link.getElementsByTagName("img")[0].getAttribute("src");
  const postName = postHeader.children[1].children[0].children[0].textContent;

  const postUrl = link.getAttribute("href");
  const postId = postUrl.split("-").pop();
  const postFavorites = getPostFavorites(postFooter);

  const authorData = postHeader.children[0];
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
  log("Found literature post");
  const previewText = post.children[1].children[0];

  const link = post.children[1].children[3];
  const postHeader = post.children[0].children[0].children[0]
  const postFooter = post.children[2].children[0]

  const postName = previewText.children[2].textContent;

  const postUrl = link.getAttribute("href");
  const postId = postUrl.split("-").pop();
  const postFavorites = getPostFavorites(postFooter);

  const authorData = postHeader.children[0];
  const platformAuthorLink = getPlatformAuthorLink(authorData);

  return new PlatformPostDetails({
    id: new PlatformID(PLATFORM, postId, config.id),
    name: postName,
    author: platformAuthorLink,
    url: postUrl,
    rating: new RatingLikes(postFavorites)
  });
}

function getPostFavorites(postFooter) {
  const favoritesStr = postFooter.children[0].children[1].textContent;
  let favoriteCount = parseFloat(favoritesStr)
  if(favoritesStr.endsWith("K")){
    favoriteCount *= 1000
  }
  if(favoritesStr.endsWith("M")){
    favoriteCount *= 1000000
  }
  return Math.trunc(favoriteCount);
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

function log(str, prefix = "") {
  if(prefix) {
    console.log(prefix);
  }
  console.log(str);
  logStr += prefix + str + "\n";
}

function logStrAsPlatformPost() {
  const strByteArray = strToUtf8Bytes(logStr);
  const strBase64 = utility.toBase64(strByteArray);
  return {
    posts: [new PlatformPost({
      id: new PlatformID(PLATFORM, "1", config.id),
      name: strBase64,
      author: new PlatformAuthorLink(
          new PlatformID(PLATFORM, "2", config.id),
          "authorName",
          "authorUrl",
          "authorAvatar"
      ),
      url: "postUrl"
    })],
    nextUrl: null
  };
}

function strToUtf8Bytes(strOrUndefined) {
  const str = "" + strOrUndefined
  const utf8 = [];
  for (let ii = 0; ii < str.length; ii++) {
    let charCode = str.charCodeAt(ii);
    if (charCode < 0x80) utf8.push(charCode);
    else if (charCode < 0x800) {
      utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      utf8.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      ii++;
      charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(ii) & 0x3ff));
      utf8.push(
          0xf0 | (charCode >> 18),
          0x80 | ((charCode >> 12) & 0x3f),
          0x80 | ((charCode >> 6) & 0x3f),
          0x80 | (charCode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
}
