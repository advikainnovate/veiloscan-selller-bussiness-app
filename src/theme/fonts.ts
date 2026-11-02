// Geist, the Seller Panel's font (next/font/google "Geist" in its layout.tsx).
// Each weight is its own file in src/assets/fonts, named after its PostScript
// name so the same fontFamily works on iOS (PostScript name) and Android (file
// name). Use these instead of fontWeight, which a custom font ignores or fakes.
//
// Adding a weight: copy the .ttf into src/assets/fonts and
// android/app/src/main/assets/fonts, list it under UIAppFonts in
// ios/VeilocanBussiness/Info.plist, and add it to the Xcode project's resources.
export const fonts = {
  regular: 'Geist-Regular', // 400
  medium: 'Geist-Medium', // 500
  semibold: 'Geist-SemiBold', // 600
  bold: 'Geist-Bold', // 700
  extrabold: 'Geist-ExtraBold', // 800
} as const;
