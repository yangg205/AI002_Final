import 'package:flutter/material.dart';

import 'core/app_colors.dart';
import 'screens/stress_check_screen.dart';

class JoyfulMindApp extends StatelessWidget {
  const JoyfulMindApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'JoyfulMind',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.background,
        fontFamily: 'sans-serif',
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.olive,
          surface: AppColors.background,
        ),
      ),
      home: const StressCheckScreen(),
    );
  }
}
