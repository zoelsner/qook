import { Stack } from 'expo-router';
import { palette } from '../../src/design';

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  );
}
