import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  "bg-white border rounded-lg text-base text-gray-800",
  {
    variants: {
      variant: {
        default: "border-gray-300 focus:border-primary-500",
        error: "border-red-500 focus:border-red-600",
        success: "border-green-500 focus:border-green-600",
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