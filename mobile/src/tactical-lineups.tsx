import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { contrastTextColor, useMobileBranding } from "@/branding";
import { Card } from "@/components";
import { playerOverall } from "@/player-card";
import { Avatar } from "@/statistics-ui";
import { buildTacticalLineup, tacticalFormationLabel, tacticalFormationSize, type TacticalFormationOption } from "@/tactical-lineup";
import type { Player, TeamResult } from "@/types";

const registeredOverall = (player: Player, config: TeamResult) => playerOverall(player, config as any);

export function TacticalLineups({ result }: { result: TeamResult }) {
  const { config: brand, palette } = useMobileBranding();
  const formations = brand.tacticalFormations;
  const labels = formations.map(tacticalFormationLabel).join(" e ");
  const sizes = [...new Set(formations.map(tacticalFormationSize))];
  return <Card style={[styles.tacticalPreview,{backgroundColor:palette.cream,borderColor:`${palette.text}28`}]}><View style={{gap:4}}><Text style={[styles.eyebrow,{color:palette.green}]}>VISÃO TÁTICA SUGERIDA</Text><Text style={[styles.title,{color:palette.text}]}>Prováveis titulares por posição</Text><Text style={[styles.help,{color:palette.text}]}>Comparamos {labels} para {sizes.map(size=>`Fut${size}`).join(" ou ")} e priorizamos a opção mais próxima do tamanho atual do time. A posição secundária pode completar uma vaga.</Text></View><MobileTacticalPitch title={`Time ${brand.teamBlueName}`} color={palette.blue} players={result.blue} config={result} formations={formations}/><MobileTacticalPitch title={`Time ${brand.teamYellowName}`} color={palette.yellow} players={result.yellow} config={result} formations={formations}/></Card>;
}

function MobileTacticalPitch({title,color,players,config,formations}:{title:string;color:string;players:Player[];config:TeamResult;formations:TacticalFormationOption[]}) {
  const { palette } = useMobileBranding();
  const lineup = useMemo(() => buildTacticalLineup(players, player => registeredOverall(player, config), formations), [players, config, formations]);
  const lineColor = `${palette.text}28`, teamSoft = `${color}1F`;
  const rows=[{role:"Ataque",members:lineup.attackers,slots:lineup.slots.attackers},{role:"Meio-campo",members:lineup.midfielders,slots:lineup.slots.midfielders},{role:"Defesa",members:lineup.defenders,slots:lineup.slots.defenders},{role:"Goleiro",members:lineup.goalkeeper?[lineup.goalkeeper]:[],slots:lineup.slots.goalkeepers}];
  return <View style={[styles.tacticalTeam,{backgroundColor:palette.cream,borderColor:`${color}70`}]}><View style={[styles.tacticalTeamHead,{backgroundColor:teamSoft,borderBottomColor:lineColor}]}><View style={{flexDirection:"row",alignItems:"center",gap:8,flex:1,minWidth:0}}><View style={{width:10,height:10,borderRadius:5,backgroundColor:color}}/><Text numberOfLines={1} style={{color:palette.text,fontSize:17,fontWeight:"900",flex:1}}>{title}</Text></View><Text style={[styles.tacticalFormation,{color:contrastTextColor(color),borderColor:color,backgroundColor:color}]}>{lineup.formation}</Text></View><View style={styles.tacticalField}><View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={styles.tacticalStripes}>{Array.from({length:6},(_,index)=><View key={index} style={{flex:1,backgroundColor:index%2?"transparent":"rgba(255,255,255,.035)"}}/>)}</View><View style={styles.tacticalHalfway}/><View style={styles.tacticalCircle}/><View style={[styles.tacticalBox,{top:0}]}/><View style={[styles.tacticalBox,{bottom:0}]}/></View>{rows.map(row=>{const width=`${Math.max(13,Math.min(31,96/Math.max(1,row.slots)))}%` as `${number}%`;return <View style={styles.tacticalFieldRow} key={row.role}><Text style={styles.tacticalFieldLabel}>{row.role.toLocaleUpperCase("pt-BR")}</Text><View style={styles.tacticalFormationRow}>{row.members.map(member=><View style={[styles.tacticalPlayer,{width}]} key={member.player.id}><View style={styles.tacticalPhoto}><Avatar player={member.player} size={42}/></View><Text numberOfLines={1} style={[styles.tacticalPlayerName,{backgroundColor:`${palette.cream}E8`,color:palette.text}]}>{member.player.displayName}</Text><Text style={styles.tacticalPlayerScore}>{member.rating.toFixed(1)}{member.usedSecondaryPosition?" · 2ª pos.":""}</Text></View>)}{Array.from({length:Math.max(0,row.slots-row.members.length)},(_,index)=><View style={[styles.tacticalPlayer,{width}]} key={`${row.role}-${index}`}><View style={styles.tacticalVacancy}><Text style={{color:"#E0F0E5",fontSize:20}}>+</Text></View><Text style={styles.tacticalPlayerScore}>Vaga</Text></View>)}</View></View>})}</View><View style={[styles.tacticalFooter,{backgroundColor:teamSoft,borderTopColor:lineColor}]}><Text style={{color:palette.text}}><Text style={{fontWeight:"900"}}>{lineup.filledSlots}/{lineup.totalSlots}</Text> posições preenchidas</Text>{lineup.reserves.length?<View style={styles.tacticalReserves}><Text style={[styles.tacticalReserveLabel,{color:palette.text}]}>OPÇÕES</Text>{lineup.reserves.map(player=><View key={player.id} style={[styles.tacticalReserve,{backgroundColor:palette.cream,borderColor:lineColor}]}><Avatar player={player} size={25}/><View style={styles.tacticalReserveDetails}><Text numberOfLines={1} style={[styles.tacticalReserveName,{color:palette.text}]}>{player.displayName}</Text><Text numberOfLines={1} style={[styles.tacticalReservePosition,{color:palette.text}]}>Principal: {player.primaryPosition||"Não informada"}{player.secondaryPosition?` · Secundária: ${player.secondaryPosition}`:""}</Text></View><Text style={{color:contrastTextColor(color),backgroundColor:color,borderRadius:20,overflow:"hidden",paddingVertical:3,paddingHorizontal:6,fontSize:10,fontWeight:"900"}}>{registeredOverall(player,config).toFixed(1)}</Text></View>)}</View>:<Text style={{color:palette.text,fontSize:11}}>Sem jogadores fora do time sugerido.</Text>}</View></View>;
}

const styles = StyleSheet.create({
  tacticalPreview:{gap:14,padding:14},
  eyebrow:{fontSize:9,fontWeight:"900",letterSpacing:1.2},
  title:{fontSize:18,fontWeight:"900"},
  help:{lineHeight:19},
  tacticalTeam:{borderWidth:1,borderRadius:15,overflow:"hidden",backgroundColor:"#fff"},
  tacticalTeamHead:{minHeight:50,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,borderBottomWidth:1},
  tacticalFormation:{paddingVertical:5,paddingHorizontal:8,borderWidth:1,borderRadius:8,fontWeight:"900",fontSize:12},
  tacticalField:{position:"relative",minHeight:455,paddingVertical:13,paddingHorizontal:7,backgroundColor:"#216D45",borderLeftWidth:3,borderRightWidth:3,borderColor:"#A8CFB5",overflow:"hidden",justifyContent:"space-around"},
  tacticalStripes:{position:"absolute",top:0,right:0,bottom:0,left:0,flexDirection:"column"},
  tacticalHalfway:{position:"absolute",top:"50%",left:0,right:0,borderTopWidth:1,borderColor:"#8EBDA1"},
  tacticalCircle:{position:"absolute",top:"50%",left:"50%",width:82,height:82,borderRadius:41,borderWidth:1,borderColor:"#8EBDA1",transform:[{translateX:-41},{translateY:-41}]},
  tacticalBox:{position:"absolute",left:"22%",width:"56%",height:38,borderWidth:1,borderColor:"#8EBDA1"},
  tacticalFieldRow:{minHeight:100,justifyContent:"center",gap:5},
  tacticalFieldLabel:{alignSelf:"center",paddingVertical:2,paddingHorizontal:6,borderRadius:5,overflow:"hidden",backgroundColor:"rgba(11,58,40,.55)",color:"#E4F3E9",fontSize:8,fontWeight:"900",letterSpacing:.6},
  tacticalFormationRow:{flexDirection:"row",justifyContent:"space-evenly",alignItems:"flex-start",gap:4},
  tacticalPlayer:{width:"31%",minWidth:0,alignItems:"center",gap:3},
  tacticalPhoto:{borderRadius:24,borderWidth:2,borderColor:"#fff",overflow:"hidden"},
  tacticalPlayerName:{maxWidth:"100%",paddingVertical:3,paddingHorizontal:5,borderRadius:6,overflow:"hidden",fontSize:10,fontWeight:"900",textAlign:"center"},
  tacticalPlayerScore:{color:"#E0F0E5",fontSize:8,textAlign:"center"},
  tacticalVacancy:{width:42,height:42,borderRadius:21,borderWidth:1,borderStyle:"dashed",borderColor:"#C5DFC9",alignItems:"center",justifyContent:"center"},
  tacticalFooter:{padding:11,gap:8,borderTopWidth:1},
  tacticalReserves:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:6},
  tacticalReserveLabel:{fontSize:8,fontWeight:"900",letterSpacing:.7},
  tacticalReserve:{maxWidth:"100%",flexDirection:"row",alignItems:"center",gap:5,paddingVertical:4,paddingHorizontal:7,borderWidth:1,borderRadius:99},
  tacticalReserveDetails:{maxWidth:155,flexShrink:1,gap:1},
  tacticalReserveName:{fontSize:11,fontWeight:"800"},
  tacticalReservePosition:{fontSize:8,opacity:.78},
});
