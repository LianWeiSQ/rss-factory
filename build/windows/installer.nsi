; KnowledgeHub NSIS Installer Script
; This script creates a Windows installer for KnowledgeHub
;
; IMPORTANT: This script creates a Windows installer for KnowledgeHub
;
; To build:
;   makensis build/windows/installer.nsi
;
; All paths in this script are relative to the script directory.

!define APP_NAME "Knowledge Hub"
; Persistent installer identity: retain CSS Factory upgrade keys and install directory.
!define APP_ID "CSS Factory"
!define APP_VERSION "1.3.41"
!define APP_VERSION_NUMERIC "1.3.41.0"  ; NSIS requires X.X.X.X format
!define APP_PUBLISHER "LianWeiSQ"
!define APP_URL "https://github.com/LianWeiSQ/rss-factory"
!define APP_DESCRIPTION "A Modern, Cross-Platform Desktop RSS Reader"
!define APP_EXE "KnowledgeHub.exe"

; Include Modern UI
!include "MUI2.nsh"

; General Settings
Name "${APP_NAME} ${APP_VERSION}"
; Output path relative to script directory
OutFile "..\bin\KnowledgeHub-${APP_VERSION}-windows-amd64-installer.exe"
InstallDir "$PROGRAMFILES64\${APP_ID}"
InstallDirRegKey HKLM "Software\${APP_ID}" "Install_Dir"
RequestExecutionLevel admin

; MUI Settings
!define MUI_ABORTWARNING
; Use custom icons from build/windows/
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

; Welcome page
!insertmacro MUI_PAGE_WELCOME

; License page
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"

; Directory page
!insertmacro MUI_PAGE_DIRECTORY

; Instfiles page
!insertmacro MUI_PAGE_INSTFILES

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APP_NAME}"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Version Information
VIProductVersion "${APP_VERSION_NUMERIC}"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_DESCRIPTION}"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Copyright (C) Ch3nyang and contributors"

; Installer Sections
Section "MainSection" SEC01
    SetOutPath "$INSTDIR"

    ; Install the new executable before cleaning legacy launcher paths.
    File "..\bin\${APP_EXE}"

    ; Keep the persistent installation identity, but retire the previous binary/shortcuts.
    Delete "$INSTDIR\CSSFactory.exe"
    Delete "$SMPROGRAMS\${APP_ID}\${APP_ID}.lnk"
    Delete "$SMPROGRAMS\${APP_ID}\Uninstall.lnk"
    RMDir "$SMPROGRAMS\${APP_ID}"
    Delete "$DESKTOP\${APP_ID}.lnk"

    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

    ; Write registry keys
    WriteRegStr HKLM "Software\${APP_ID}" "Install_Dir" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "URLInfoAbout" "${APP_URL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\${APP_EXE}"
    Delete "$INSTDIR\Uninstall.exe"

    ; Remove shortcuts
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"

    ; Remove installation directory
    RMDir "$INSTDIR"

    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
    DeleteRegKey HKLM "Software\${APP_ID}"

    ; Note: User data directory is NOT removed to preserve user data
    ; Data location: %APPDATA%\MrRSS
SectionEnd
