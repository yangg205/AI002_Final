import 'package:flutter/material.dart';

import '../core/app_colors.dart';
import '../models/mood_option.dart';
import '../widgets/app_bottom_navigation.dart';
import '../widgets/app_header.dart';
import '../widgets/hero_illustration.dart';
import '../widgets/mood_card.dart';
import '../widgets/save_result_button.dart';
import '../widgets/stress_level_card.dart';

class StressCheckScreen extends StatefulWidget {
  const StressCheckScreen({super.key});

  @override
  State<StressCheckScreen> createState() => _StressCheckScreenState();
}

class _StressCheckScreenState extends State<StressCheckScreen> {
  double _stressLevel = .61;
  int _selectedMood = 1;

  String get _levelLabel {
    if (_stressLevel < .34) return 'Khá thoải mái';
    if (_stressLevel < .72) return 'Hơi căng thẳng';
    return 'Rất căng thẳng';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AppHeader(
              onBellTap: () => _showMessage('Bạn chưa có thông báo mới'),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(22, 30, 22, 28),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const HeroIllustration(),
                        const SizedBox(height: 25),
                        const Text(
                          'Đo Stress',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 42,
                            height: 1.08,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.5,
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Cùng kiểm tra xem hôm nay bạn cảm\nthấy thế nào nhé!',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 19,
                            height: 1.55,
                            color: AppColors.darkText,
                          ),
                        ),
                        const SizedBox(height: 34),
                        StressLevelCard(
                          value: _stressLevel,
                          label: _levelLabel,
                          onChanged: (value) =>
                              setState(() => _stressLevel = value),
                        ),
                        const SizedBox(height: 42),
                        const Text(
                          'Hôm nay bạn thấy thế nào?',
                          style: TextStyle(
                            fontSize: 27,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -.6,
                          ),
                        ),
                        const SizedBox(height: 18),
                        _buildMoodGrid(),
                        const SizedBox(height: 38),
                        SaveResultButton(onPressed: _saveResult),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNavigation(),
    );
  }

  Widget _buildMoodGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.18,
      ),
      itemCount: moodOptions.length,
      itemBuilder: (context, index) => MoodCard(
        mood: moodOptions[index],
        selected: _selectedMood == index,
        onTap: () => setState(() => _selectedMood = index),
      ),
    );
  }

  void _saveResult() {
    _showMessage('Đã lưu: ${moodOptions[_selectedMood].label} • $_levelLabel');
  }

  void _showMessage(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
      );
  }
}
