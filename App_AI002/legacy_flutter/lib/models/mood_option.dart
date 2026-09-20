import 'package:flutter/material.dart';

class MoodOption {
  const MoodOption(this.label, this.icon, this.color, this.iconColor);

  final String label;
  final IconData icon;
  final Color color;
  final Color iconColor;
}

const moodOptions = [
  MoodOption(
    'Rất tuyệt vời',
    Icons.light_mode_outlined,
    Color(0xFF7DF19D),
    Color(0xFF08793D),
  ),
  MoodOption(
    'Hơi u ám chút',
    Icons.cloud_outlined,
    Color(0xFFA42D58),
    Colors.white,
  ),
  MoodOption(
    'Quá tải rồi',
    Icons.bolt_rounded,
    Color(0xFFFFD426),
    Color(0xFF685200),
  ),
  MoodOption(
    'Buồn ngủ rũ rượi',
    Icons.dark_mode_outlined,
    Color(0xFFE9E6DE),
    Color(0xFF554F3E),
  ),
];
