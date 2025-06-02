import React from 'react';
import { Pressable, Text } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-lg font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 active:bg-primary-600 dark:bg-primary-400 dark:active:bg-primary-300",
        secondary: "bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:active:bg-gray-600",
        outline: "border border-gray-300 bg-transparent active:bg-gray-50 dark:border-gray-600 dark:active:bg-gray-700",
        ghost: "bg-transparent active:bg-gray-100 dark:active:bg-gray-700",
      },
      size: {
        sm: "px-3 py-2",
        md: "px-4 py-2.5", 
        lg: "px-6 py-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

const textVariants = cva("font-medium", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-gray-900 dark:text-gray-100",
      outline: "text-gray-900 dark:text-gray-100",
      ghost: "text-primary-500 dark:text-primary-400 underline",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function Button({ title, variant, size, onPress, disabled, className }: ButtonProps) {
  return (
    <Pressable
      className={`${buttonVariants({ variant, size })} ${disabled ? 'opacity-60' : ''} ${className || ''}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={textVariants({ variant, size })}>
        {title}
      </Text>
    </Pressable>
  );
}