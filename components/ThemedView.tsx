import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
};

export function ThemedView({ style, lightColor, darkColor, className, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return (
    <View
      className={`${className ?? ''} dark:bg-gray-900`}   // 🆕 auto dark bg
      style={[{ backgroundColor }, style]}
      {...otherProps}
    />
  );
}
