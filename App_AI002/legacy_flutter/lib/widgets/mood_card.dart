import 'package:flutter/material.dart';

import '../core/app_colors.dart';
import '../models/mood_option.dart';

class MoodCard extends StatelessWidget {
  const MoodCard({
    super.key,
    required this.mood,
    required this.selected,
    required this.onTap,
  });

  final MoodOption mood;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFFFE5EB) : AppColors.cream,
      borderRadius: BorderRadius.circular(43),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(43),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(43),
            border: selected
                ? Border.all(color: AppColors.burgundy, width: 2.5)
                : null,
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A7B6500),
                blurRadius: 10,
                offset: Offset(0, 5),
              ),
            ],
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 78,
                      height: 78,
                      decoration: BoxDecoration(
                        color: mood.color,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(mood.icon, color: mood.iconColor, size: 43),
                    ),
                    const SizedBox(height: 11),
                    Text(
                      mood.label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                const Positioned(
                  right: -8,
                  top: -10,
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: AppColors.burgundy,
                    child: Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
