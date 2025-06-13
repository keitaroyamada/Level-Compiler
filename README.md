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

   <img src=https://github.com/user-attachments/assets/3a655662-f4a7-4ef6-b2ff-37fea310978b width="300" >

3. Run installed Level Compiler and press "Done" on the security warning. This is because this app is signed but not notarised. This action is required only during the first launch.

   <img src=https://github.com/user-attachments/assets/3921d79a-2cd5-4bf3-b79f-b100c54c3945 width="300" >

4. Go to Settings > Privacy and Security, and allow the execution of Level Compiler.

    <img src=https://github.com/user-attachments/assets/8c2defa2-22ce-4efc-abf0-1fc65158ec0f width="400" >

## 3. Usage
The detailed usage will be uploaded by this summer.  
- 0. About Level Compiler
- 1.1. Load correlation and age models
- 1.2. Plot data -Plotter-
- 1.3. Batch depth conversion -Converter-
- 1.4. Calc sampling depth -Divider-
- 2.1. Description on core image -Labeler-  
        ['Labeler Usage (English / 日本語)'](https://youtu.be/SkIqG0wph_U)
- 2.2. Make model -Edit mode-  
        ['Make model (English / 日本語)'](https://youtu.be/iKafKTT8cCY)
- 2.3. Make model -with spreadsheet-    

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
