import 'package:ai002/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('stress check screen renders and mood can be selected', (
    tester,
  ) async {
    await tester.pumpWidget(const JoyfulMindApp());

    expect(find.text('JoyfulMind'), findsOneWidget);
    expect(find.text('Đo Stress'), findsNWidgets(2));
    expect(find.text('Hơi u ám chút'), findsOneWidget);

    await tester.dragUntilVisible(
      find.text('Rất tuyệt vời'),
      find.byType(Scrollable),
      const Offset(0, -450),
    );
    await tester.tap(find.text('Rất tuyệt vời'));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Lưu Kết Quả'),
      find.byType(Scrollable),
      const Offset(0, -500),
    );
    await tester.tap(find.text('Lưu Kết Quả'));
    await tester.pump();

    expect(find.textContaining('Đã lưu: Rất tuyệt vời'), findsOneWidget);
  });
}
