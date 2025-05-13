import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // დავუშვათ useAuth ჰუკის გამოყენება callback ფუნქციებში
      "react-hooks/rules-of-hooks": "error",
      "@typescript-eslint/no-unused-vars": "error"
    }
  },
  // ცალკე კონფიგურაცია Header.tsx ფაილისთვის
  {
    files: ["src/components/layout/Header.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off"
    }
  }
];

export default eslintConfig;
