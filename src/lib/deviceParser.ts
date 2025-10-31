/**
 * Parse User-Agent string to extract device information
 * Uses simple regex patterns for common browsers and OS
 */

interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: "mobile" | "tablet" | "desktop";
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  if (!userAgent) {
    return {
      browser: "Unknown",
      browserVersion: "",
      os: "Unknown",
      osVersion: "",
      deviceType: "desktop",
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect Browser
  let browser = "Unknown";
  let browserVersion = "";

  if (ua.includes("edg/")) {
    browser = "Edge";
    browserVersion = extractVersion(ua, /edg\/([\d.]+)/);
  } else if (ua.includes("chrome/") && !ua.includes("edg")) {
    browser = "Chrome";
    browserVersion = extractVersion(ua, /chrome\/([\d.]+)/);
  } else if (ua.includes("firefox/")) {
    browser = "Firefox";
    browserVersion = extractVersion(ua, /firefox\/([\d.]+)/);
  } else if (ua.includes("safari/") && !ua.includes("chrome")) {
    browser = "Safari";
    browserVersion = extractVersion(ua, /version\/([\d.]+)/);
  } else if (ua.includes("opera") || ua.includes("opr/")) {
    browser = "Opera";
    browserVersion = extractVersion(ua, /(?:opera|opr)\/([\d.]+)/);
  }

  // Detect OS
  let os = "Unknown";
  let osVersion = "";

  if (ua.includes("windows nt")) {
    os = "Windows";
    const version = extractVersion(ua, /windows nt ([\d.]+)/);
    osVersion = mapWindowsVersion(version);
  } else if (ua.includes("mac os x")) {
    os = "macOS";
    osVersion = extractVersion(ua, /mac os x ([\d_]+)/).replace(/_/g, ".");
  } else if (ua.includes("android")) {
    os = "Android";
    osVersion = extractVersion(ua, /android ([\d.]+)/);
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = ua.includes("ipad") ? "iPadOS" : "iOS";
    osVersion = extractVersion(ua, /os ([\d_]+)/).replace(/_/g, ".");
  } else if (ua.includes("linux")) {
    os = "Linux";
  } else if (ua.includes("cros")) {
    os = "Chrome OS";
  }

  // Detect Device Type
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";

  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    deviceType = "mobile";
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
  };
}

function extractVersion(ua: string, regex: RegExp): string {
  const match = ua.match(regex);
  return match ? match[1] : "";
}

function mapWindowsVersion(version: string): string {
  const versionMap: Record<string, string> = {
    "10.0": "10/11",
    "6.3": "8.1",
    "6.2": "8",
    "6.1": "7",
    "6.0": "Vista",
    "5.1": "XP",
  };
  return versionMap[version] || version;
}
