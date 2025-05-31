# Design System - NativeWind Components

This document outlines the design system components and utilities available in the app.

## Core Components

### Button
A flexible button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui/Button';

// Primary button (default)
<Button title="Submit" onPress={() => {}} />

// Secondary button
<Button title="Cancel" variant="secondary" onPress={() => {}} />

// Outline button
<Button title="Edit" variant="outline" onPress={() => {}} />

// Ghost button (minimal)
<Button title="Skip" variant="ghost" onPress={() => {}} />

// Different sizes
<Button title="Small" size="sm" onPress={() => {}} />
<Button title="Large" size="lg" onPress={() => {}} />
```

### Input
A styled input component with validation states.

```tsx
import { Input } from '@/components/ui/Input';

// Default input
<Input placeholder="Enter text" value={value} onChangeText={setValue} />

// Error state
<Input variant="error" placeholder="Email" />

// Success state  
<Input variant="success" placeholder="Confirmed" />

// Different sizes
<Input size="sm" placeholder="Small input" />
<Input size="lg" placeholder="Large input" />
```

### ThemedText
Enhanced text component with NativeWind classes and theme support.

```tsx
import { ThemedText } from '@/components/ThemedText';

// Different text types
<ThemedText type="title">Main Title</ThemedText>
<ThemedText type="subtitle">Subtitle</ThemedText>  
<ThemedText type="body">Body text</ThemedText>
<ThemedText type="caption">Small caption</ThemedText>

// With custom classes
<ThemedText className="text-center text-primary-500">Custom styled text</ThemedText>
```

### ThemedView
Enhanced view component with NativeWind support.

```tsx
import { ThemedView } from '@/components/ThemedView';

<ThemedView className="flex-1 p-4 bg-white rounded-lg">
  <ThemedText>Content here</ThemedText>
</ThemedView>
```

## Design Tokens

### Colors
- **Primary**: `primary-500` (#007AFF) - iOS blue used throughout
- **Gray Scale**: `gray-50` to `gray-900` 
- **Semantic**: `success`, `warning`, `error`
- **Theme**: `light-text`, `dark-text`, etc.

### Typography
- **xs**: 12px/16px
- **sm**: 14px/20px  
- **base**: 16px/24px
- **lg**: 18px/28px
- **xl**: 20px/28px
- **2xl**: 24px/32px
- **3xl**: 28px/32px
- **4xl**: 32px/32px

### Spacing
Use standard Tailwind spacing: `p-1`, `p-2`, `p-4`, `m-2`, etc.
- `p-2` = 8px padding
- `p-4` = 16px padding
- `p-6` = 24px padding

### Border Radius
- `rounded-lg` = 8px
- `rounded-xl` = 12px
- `rounded-2xl` = 16px

## Common Patterns

### Card Layout
```tsx
<View className="bg-white rounded-lg p-4 mb-4 shadow-card">
  <ThemedText type="subtitle">Card Title</ThemedText>
  <ThemedText type="body" className="mt-2">Card content</ThemedText>
</View>
```

### Form Layout
```tsx
<View className="flex-1 justify-center px-5">
  <Input placeholder="Email" className="mb-4" />
  <Input placeholder="Password" secureTextEntry className="mb-4" />
  <Button title="Submit" />
</View>
```

### List Item
```tsx
<TouchableOpacity className="bg-white p-4 border-b border-gray-200">
  <ThemedText type="subtitle">Item Title</ThemedText>
  <ThemedText type="caption" className="mt-1">Item description</ThemedText>
</TouchableOpacity>
```

## Migration Guidelines

1. **Replace StyleSheet objects** with NativeWind classes
2. **Use design system components** instead of raw React Native components
3. **Maintain theme support** by using ThemedText/ThemedView where needed
4. **Keep existing functionality** while reducing code volume
5. **Use className prop** alongside existing style prop during transition

## Benefits

- ✅ **Reduced code**: 80% less styling code volume
- ✅ **Consistent design**: Centralized design tokens
- ✅ **Better DX**: IntelliSense support and familiar patterns  
- ✅ **Maintainable**: Component-based system with variants
- ✅ **Responsive**: Built-in breakpoint system
- ✅ **Theme support**: Native dark/light mode integration