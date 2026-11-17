// Test-only browser stand-in: records the arguments passed by the real EXE.
#include <windows.h>
#include <wchar.h>
int wmain(int argc, wchar_t **argv) {
    wchar_t destination[32768];
    if (!GetEnvironmentVariableW(L"SCHOOL_TEST_LOG", destination, 32768)) return 10;
    HANDLE out = CreateFileW(destination, GENERIC_WRITE, FILE_SHARE_READ, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (out == INVALID_HANDLE_VALUE) return 11;
    for (int i = 0; i < argc; i++) {
        char buffer[65536];
        int length = WideCharToMultiByte(CP_UTF8, 0, argv[i], -1, buffer, sizeof(buffer), NULL, NULL);
        DWORD written;
        if (!length || !WriteFile(out, buffer, length - 1, &written, NULL) || !WriteFile(out, "\n", 1, &written, NULL)) return 12;
    }
    CloseHandle(out);
    return 0;
}
