#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <strsafe.h>
#include <wchar.h>

#define PATH_CAP 32768
#define GAME_URL L"https://motracv.github.io/-/school.html?desktop=1"
#define APP_TITLE L"학교용병단"

typedef enum { BROWSER_EDGE, BROWSER_CHROME } Browser;

static const wchar_t *browserName(Browser browser) {
    return browser == BROWSER_CHROME ? L"chrome.exe" : L"msedge.exe";
}

static BOOL validBrowserPath(const wchar_t *path, Browser browser) {
    const wchar_t *basename = wcsrchr(path, L'\\');
    if (!basename || wcschr(path, L'"') || lstrcmpiW(basename + 1, browserName(browser))) return FALSE;
    DWORD attr = GetFileAttributesW(path);
    return attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

static BOOL registryPath(HKEY hive, REGSAM view, Browser browser, wchar_t *output, size_t capacity) {
    wchar_t key[256], raw[PATH_CAP];
    HKEY handle;
    DWORD type = 0, size = sizeof(raw) - sizeof(wchar_t);
    if (FAILED(StringCchPrintfW(key, ARRAYSIZE(key),
        L"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\%ls", browserName(browser)))) return FALSE;
    if (RegOpenKeyExW(hive, key, 0, KEY_QUERY_VALUE | view, &handle) != ERROR_SUCCESS) return FALSE;
    LONG result = RegQueryValueExW(handle, NULL, NULL, &type, (LPBYTE)raw, &size);
    RegCloseKey(handle);
    if (result != ERROR_SUCCESS || (type != REG_SZ && type != REG_EXPAND_SZ) || size % sizeof(wchar_t)) return FALSE;
    raw[size / sizeof(wchar_t)] = 0;
    wchar_t *start = raw;
    size_t length = wcslen(start);
    if (length >= 2 && start[0] == L'"' && start[length - 1] == L'"') {
        start[length - 1] = 0;
        start++;
    }
    if (type == REG_EXPAND_SZ) {
        DWORD needed = ExpandEnvironmentStringsW(start, output, (DWORD)capacity);
        if (!needed || needed > capacity) return FALSE;
    } else if (FAILED(StringCchCopyW(output, capacity, start))) return FALSE;
    return validBrowserPath(output, browser);
}

static BOOL findBrowser(Browser browser, wchar_t *output, size_t capacity) {
    const HKEY hives[] = { HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE };
    const REGSAM views[] = { KEY_WOW64_64KEY, KEY_WOW64_32KEY };
    for (size_t h = 0; h < ARRAYSIZE(hives); h++) {
        for (size_t v = 0; v < ARRAYSIZE(views); v++) {
            if (registryPath(hives[h], views[v], browser, output, capacity)) return TRUE;
        }
    }
    const wchar_t *roots[] = { L"ProgramFiles", L"ProgramFiles(x86)", L"LOCALAPPDATA" };
    const wchar_t *relative = browser == BROWSER_CHROME
        ? L"Google\\Chrome\\Application\\chrome.exe" : L"Microsoft\\Edge\\Application\\msedge.exe";
    wchar_t root[PATH_CAP];
    for (size_t i = 0; i < ARRAYSIZE(roots); i++) {
        DWORD length = GetEnvironmentVariableW(roots[i], root, ARRAYSIZE(root));
        if (!length || length >= ARRAYSIZE(root)) continue;
        if (SUCCEEDED(StringCchPrintfW(output, capacity, L"%ls\\%ls", root, relative)) && validBrowserPath(output, browser)) return TRUE;
    }
    return FALSE;
}

static Browser preferredBrowser(void) {
    HKEY key;
    wchar_t progId[256] = { 0 };
    DWORD size = sizeof(progId) - sizeof(wchar_t), type;
    if (RegOpenKeyExW(HKEY_CURRENT_USER,
        L"Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
        0, KEY_QUERY_VALUE, &key) == ERROR_SUCCESS) {
        LONG result = RegQueryValueExW(key, L"ProgId", NULL, &type, (LPBYTE)progId, &size);
        RegCloseKey(key);
        if (result == ERROR_SUCCESS && type == REG_SZ && wcsncmp(progId, L"Chrome", 6) == 0) return BROWSER_CHROME;
    }
    return BROWSER_EDGE;
}

static BOOL buildCommand(const wchar_t *browser, wchar_t *command, size_t capacity) {
    // Use the installed browser's normal profile so existing site saves and
    // Google login remain available. Never accept URLs or arbitrary flags.
    return SUCCEEDED(StringCchPrintfW(command, capacity,
        L"\"%ls\" --app=\"%ls\" --start-maximized --no-first-run", browser, GAME_URL));
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR commandLine, int show) {
    (void)instance; (void)previous; (void)commandLine; (void)show;
    int argc;
    LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    Browser browser = preferredBrowser();
    BOOL explicitBrowser = FALSE, validArgs = argv != NULL;
    for (int i = 1; argv && i < argc; i++) {
        if (!explicitBrowser && lstrcmpW(argv[i], L"--edge") == 0) { browser = BROWSER_EDGE; explicitBrowser = TRUE; }
        else if (!explicitBrowser && lstrcmpW(argv[i], L"--chrome") == 0) { browser = BROWSER_CHROME; explicitBrowser = TRUE; }
        else validArgs = FALSE;
    }
    if (argv) LocalFree(argv);
    if (!validArgs) {
        MessageBoxW(NULL, L"School-Mercenaries.exe를 더블 클릭해 실행해 주세요.\n\n브라우저 선택: --edge 또는 --chrome", APP_TITLE, MB_OK | MB_ICONINFORMATION);
        return 2;
    }
    wchar_t path[PATH_CAP], command[PATH_CAP];
    BOOL found = findBrowser(browser, path, ARRAYSIZE(path));
    if (!found && !explicitBrowser) {
        browser = browser == BROWSER_CHROME ? BROWSER_EDGE : BROWSER_CHROME;
        found = findBrowser(browser, path, ARRAYSIZE(path));
    }
    if (!found) {
        MessageBoxW(NULL,
            L"게임을 실행할 Microsoft Edge 또는 Google Chrome을 찾지 못했어요.\n"
            L"해당 브라우저를 설치한 뒤 다시 실행해 주세요.\n\n"
            L"게임 주소: https://motracv.github.io/-/school.html", APP_TITLE, MB_OK | MB_ICONERROR);
        return 3;
    }
    if (!buildCommand(path, command, ARRAYSIZE(command))) return 4;
    STARTUPINFOW startup = { 0 };
    PROCESS_INFORMATION process = { 0 };
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESHOWWINDOW;
    startup.wShowWindow = SW_SHOWMAXIMIZED;
    // Explicit executable path, no shell and no elevated permissions.
    if (!CreateProcessW(path, command, NULL, NULL, FALSE, 0, NULL, NULL, &startup, &process)) {
        wchar_t message[512];
        StringCchPrintfW(message, ARRAYSIZE(message),
            L"게임 창을 열지 못했어요. (Windows 오류 %lu)\n"
            L"Edge 또는 Chrome이 정상 실행되는지 확인해 주세요.\n\n"
            L"게임 주소: https://motracv.github.io/-/school.html", GetLastError());
        MessageBoxW(NULL, message, APP_TITLE, MB_OK | MB_ICONERROR);
        return 5;
    }
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return 0;
}
