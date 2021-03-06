/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createRequestMatcher } from "./matchers.js";
import { LoggedWhitelistRule, WhitelistRule } from "./rules/whitelist.js";
import { BlockRule } from "./rules/block.js";
import { FilterRule } from "./rules/filter.js";
import { RedirectRule } from "./rules/redirect.js";

export const ALL_URLS = "*://*/*";  // BUG: https://bugzilla.mozilla.org/show_bug.cgi?id=1557300

export function createRule(data) {
    let extraMatchers = createRequestMatcher(data);

    switch (data.action) {
        case "whitelist":
            if (data.log) {
                return new LoggedWhitelistRule(data, extraMatchers);
            } else {
                return new WhitelistRule(data, extraMatchers);
            }
        case "block":
            return new BlockRule(data, extraMatchers);
        case "redirect":
            return new RedirectRule(data, extraMatchers);
        case "filter":
            return new FilterRule(data, extraMatchers);
        default:
            throw new Error("Unsupported rule action");
    }
}

function prefixPath(path) {
    if (path.startsWith(("/")))
        return path;
    return "/" + path;
}

/**
 * Construct array of match patterns
 * @param pattern pattern of request control rule
 * @returns {*} array of match patterns
 */
export function createMatchPatterns(pattern) {
    let urls = [];
    let hosts = Array.isArray(pattern.host) ? pattern.host : [pattern.host];
    let paths = Array.isArray(pattern.path) ? pattern.path : [pattern.path];

    if (pattern.allUrls) {
        return [ALL_URLS];
    }

    if (!pattern.path || paths.length <= 0) {
        paths = [""];
    }

    for (let host of hosts) {
        if (isTLDHostPattern(host)) {
            host = host.slice(0, -1);
            for (let TLD of pattern.topLevelDomains) {
                for (let path of paths) {
                    urls.push(pattern.scheme + "://" + host + TLD + prefixPath(path));
                }
            }
        } else {
            for (let path of paths) {
                urls.push(pattern.scheme + "://" + host + prefixPath(path));
            }
        }
    }

    return urls;
}

/**
 * Construct regexp from list of globs (pattern with wildcards) and regexp pattern strings
 * @param values list of globs or regexp pattern strings
 * @param insensitive if true, set case insensitive flag
 * @param containing if false, add string begin and end .
 * @returns {RegExp}
 */
export function createRegexpPattern(values, insensitive = true, containing = false) {
    let regexpChars = /[.+^${}()|[\]\\]/g; // excluding "*" and "?" wildcard chars
    let regexpParam = /^\/(.*)\/$/;
    let flags = insensitive ? "i" : "";

    let pattern = "";
    for (let param of values) {
        let testRegexp = param.match(regexpParam);
        pattern += "|";
        pattern += containing ? "" : "^";
        if (testRegexp && isValidRegExp(testRegexp[1])) {
            pattern += testRegexp[1];
        } else {
            pattern += param.replace(regexpChars, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
        }
        pattern += containing ? "" : "$";
    }
    return new RegExp(pattern.substring(1), flags);
}

export function isTLDHostPattern(host) {
    let hostTLDWildcardPattern = /^(.+)\.\*$/;
    return hostTLDWildcardPattern.test(host);
}

function isValidRegExp(pattern) {
    try {
        new RegExp(pattern);
    } catch {
        return false;
    }
    return true;
}
