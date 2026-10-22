# noCap vs WhisperX (large-v3) on the 20 Jam-ALT songs

Both transcribe the same Demucs vocal stems. noCap: Whisper medium.en on MLX (Apple GPU) with DTW word timings and gap repair. WhisperX 3.8.6: faster-whisper large-v3 (int8, CPU) with Silero VAD and wav2vec2 alignment. Onset metrics count only correctly recognised words, so each column is measured on its own set of words.

| Metric | noCap (current) | whisperx-large-v3 |
|---|---|---|
| WER (pooled) | 33.5% | 28.0% |
| WER, hip-hop only | 22.0% | 26.9% |
| CER (median) | 21.5% | 17.4% |
| Missing words (deletions) | 950 | 1184 |
| Wrong words (substitutions) | 971 | 506 |
| Extra words (insertions) | 170 | 58 |
| Word onset error (median) | 96 ms | 85 ms |
| Words within 100 ms | 57.8% | 70.8% |
| Words within 300 ms | 81.1% | 87.8% |
| Runaway tokens | 4 | 0 |
| Words before vocals | 7 | 0 |

| Song | WER noCap (current) | WER whisperx-large-v3 |
|---|---|---|
| Avercage_-_Embers | 69.2% | 89.7% |
| Color_Out_-_Falling_Star | 25.3% | 21.2% |
| Cortez_-_Feel__Stripped_ | 8.7% | 5.9% |
| Explosive_Ear_Candy_-_Like_The_Sun | 64.1% | 38.5% |
| HILA_-_Give_Me_the_Same | 31.7% | 10.7% |
| JASON_MILLER_-_CROWD_PLEASER | 11.4% | 18.5% |
| Kinematic_-_Peyote | 28.3% | 25.8% |
| LUNABLIND_-_Vision__Radio_Edit_ | 73.8% | 10.2% |
| Lower_Loveday_-_Is_It_Right_ | 14.8% | 8.3% |
| Moon_I_Mean_-_Wrong_Concept | 64.3% | 50.0% |
| Pure_Mids_-_The_Leader | 55.0% | 67.8% |
| Quentin_Hannappe_-_Keep_On | 24.7% | 15.3% |
| Ridgway_-_Fire_Inside | 20.1% | 19.5% |
| Rxbyn_-_Bad_Side | 28.2% | 23.1% |
| Slingshot_Miracle_-_Whistler | 23.9% | 9.8% |
| Songwriterz_-_Back_In_Time | 23.3% | 9.3% |
| The.madpix.project_-_One_Way_Street | 24.5% | 25.0% |
| The_Rinn_-_Voices__2017_Version_ | 37.1% | 30.2% |
| Tom_Orlando_-_The_One__feat._Tina_G_ | 33.7% | 50.5% |
| Wordsmith_-_The_Statement | 31.7% | 34.6% |
