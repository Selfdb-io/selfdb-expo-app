import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  // light & dark base styles
  "border rounded-lg text-base \
   bg-white dark:bg-gray-800 \
   text-gray-800 dark:text-gray-100 \
   placeholder-gray-500 dark:placeholder-gray-400",
  {
    variants: {
      variant: {
        default:
          "border-gray-300 dark:border-gray-600 \
           focus:border-primary-500 dark:focus:border-primary-400",
        error:
          "border-red-500 dark:border-red-600 \
           focus:border-red-600 dark:focus:border-red-700",
        success:
          "border-green-500 dark:border-green-600 \
           focus:border-green-600 dark:focus:border-green-700",
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-3 text-base",
        lg: "px-5 py-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface InputProps extends TextInputProps, VariantProps<typeof inputVariants> {
  className?: string;
}

export function Input({ variant, size, className, ...props }: InputProps) {
  return (
    <TextInput
      className={`${inputVariants({ variant, size })} ${className || ''}`}
      placeholderTextColor="#666"
      {...props}
    />
  );
}