export interface MediaInfoContainer
{
	MediaInfo: MediaInfo;
}

export interface MediaInfo
{
	media: [Media];
}

export interface Media
{
	track: Track[];
}

export interface Track
{
	$: { type: 'General' | 'Audio' | 'Video' | 'Image' | 'Text' };
}

export interface GeneralTrack extends Track
{
	$: { type: 'General' }
	ImageCount?: [string];
	AudioCount?: [string];
	VideoCount?: [string];
	TextCount?: [string];
	FileExtension?: [string];
	Format?: [string];
	FileSize?: [string];
	Duration?: [string];
	OverallBitRate_Mode?: [string];
	OverallBitRate?: [string];
	StreamSize?: [string];
	Title?: [string];
	Album?: [string];
	Album_Performer?: [string];
	Track?: [string];
	Track_Position?: [string];
	Performer?: [string];
	Composer?: [string];
	Recorded_Date?: [string];
	File_Modified_Date?: [string];
	File_Modified_Date_Local?: [string];
	Cover?: [string];
	Cover_Type?: [string];
	Cover_Mime?: [string];
}

export interface AudioTrack extends Track
{
	$: { type: 'Audio' };
	StreamOrder?: [string];
	ID?: [string];
	Format?: [string];
	Duration?: [string];
	BitRate_Mode?: [string];
	BitRate?: [string];
	Channels?: [string];
	ChannelPositions?: [string];
	ChannelLayout?: [string];
	SamplesPerFrame?: [string];
	SamplingRate?: [string];
	SamplingCount?: [string];
	BitDepth?: [string];
	StreamSize?: [string];
	Compression_Mode?: [string];
	StreamSize_Proportion?: [string];
	Encoded_Library?: [string];
	Encoded_Library_Name?: [string];
	Encoded_Library_Version?: [string];
	Encoded_Library_Date?: [string];
}

export interface VideoTrack extends Track
{
	$: { type: 'Video' };
	StreamOrder?: [string];
	ID?: [string];
	UniqueID?: [string];
	Format?: [string];
	Format_Profile?: [string];
	Format_Level?: [string];
	Format_Settings_CABAC?: [string];
	Format_Settings_RefFrames?: [string];
	CodecID?: [string];
	Duration?: [string];
	BitRate_Nominal?: [string];
	Width?: [string];
	Height?: [string];
	Sampled_Width?: [string];
	Sampled_Height?: [string];
	PixelAspectRatio?: [string];
	DisplayAspectRatio?: [string];
	FrameRate_Mode?: [string];
	FrameRate?: [string];
	FrameCount?: [string];
	ColorSpace?: [string];
	ChromaSubsampling?: [string];
	BitDepth?: [string];
	ScanType?: [string];
	Delay?: [string];
	Encoded_Library?: [string];
	Encoded_Library_Name?: [string];
	Encoded_Library_Version?: [string];
	Encoded_Library_Settings?: [string];
}

export interface ImageTrack extends Track
{
	$: { type: 'Image' };
	Format?: [string];
	Format_Compression?: [string];
	Width?: [string];
	Height?: [string];
	BitDepth?: [string];
	Compression_Mode?: [string];
	StreamSize?: [string];
}

export interface TextTrack extends Track
{
	$: { type: 'Text' };
	ID?: [string];
	UniqueID?: [string];
	Format?: [string];
	CodecID?: [string];
	Compression_Mode?: [string];
	Default?: [string];
	Forced?: [string];
}