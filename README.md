# Level-Compiler
<img src=https://github.com/user-attachments/assets/b80709f2-e609-445f-a5c5-542b0d91c9ba width="500" >

## 1. About
Level Compiler (LC) is an integrated stratigraphic management software capable of creating and managing correlation models of sedimentary sequences. The system enables the management of multiple sediment cores on a unified depth or age scale. It also incorporates a "divider" that reprojects actual stratigraphic samples onto modelled depths, facilitating precise correlation across different researchers.

## 2. Install
### 2.1. Recommended environments(Development environment)
- Windows11
- macOS (+Apple silicon)
  
### 2.2. Windows
1. Download installer (*.exe) from the right panel ["Releases"](https://github.com/keitaroyamada/Level-Compiler/releases).
2. Run downloaded exe file.

### 2.3. Mac(Apple silicon)
1. Download installer (*.dmg) from the right panel ["Releases"](https://github.com/keitaroyamada/Level-Compiler/releases).
2. Run downloaded "*.dmg" file and install Level Compiler.

## 3. Usage
The detailed usage will be uploaded by this summer.  
- 0. About Level Compiler
- 1.1. Load correlation and age models  ['Load models' (English / 日本語)](https://youtu.be/Ydsx8dgI5Ec)
- 1.2. Load section images ['Load section images' (English / 日本語)](https://youtu.be/wR7f6GwND_s)
- 1.3. Plot data -Plotter-
- 1.4. Batch depth conversion -Converter-
- 1.5. Calc sampling depth -Divider-
- 2.1. Description on core image -Labeler-   ['Labeler Usage (English / 日本語)'](https://youtu.be/SkIqG0wph_U)
- 2.2. Make model from GUI  ['Make model (English / 日本語)'](https://youtu.be/iKafKTT8cCY)
- 2.3. Make model from spreadsheet    

## 4. Build from code(optional)
  __This section is optional.__ If it is not necessary, please proceed to [the next section](#3-Install).
  
  This step explains how to build the application from the source code.

- Windows11 & Mac (+Apple silicon)    
1. Download and install Python3 from [official site](https://www.python.org/).
2. Download and install Node.js form [official site](https://nodejs.org/en/).
3. Download and this repository from right upper green "Code" > "Download Zip".
4. Unzip the downloaded Zip file.
5. Start terminanl and move to the unzipped directory using change directory command("cd") and list segments command("ls").
6. Run the following code into the terminal to Install requirement packages.
   ```
   npm install
   npm list
   ```
   
7. Run the following code into the terminal to build executable file.

   - Windows11
   ```
   npm run build:win
   ```
   - Mac (+Apple silicon)
   ```
   npm run build:mac
   ```

8. Signing to the application (more optional)
   - Install Command line developper tools.
   - Generate Certificate Signing Request(CSR) file from Keychain.
   - Enroll in the Apple Developer Program.
   - Generate the Developer ID Application certificate(*.cer) from ADP using CSR.
   - Download and install CER file.
   - Download　Apple PKI file.
   - Check “Trust" the certificate.
   - The app will be automatically signed during the build process.
   
9. Move to next section.

## 5. References
