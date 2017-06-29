<!DOCTYPE html>
<!-- 
Copyright 2017 Jonathon Hare / The University of Southampton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1280">
  <title>JSNB</title>
  <link rel="stylesheet" type="text/css" href="css/style.css">

  <script type="text/javascript" src="js/jquery-2.1.3.min.js"></script>

</head>
<body>
  <?php include_once("analyticstracking.php") ?>
  
  <h1>Welcome to Javascript Worksheet</h1>

  Javascript Worksheet lets you create interactive javascript worksheets for teaching and other uses. 
  <br /> <br/>
  <a href="worksheet.html?expert">Create New Interactive Worksheet</a>
  <br />

  <h2>Worksheets for teaching:</h2>
  <?php
    $files = scandir("saved-code");
    $i = 0;
    foreach ($files as $file) {
      if (strlen($file) > 10) {
        $str = file_get_contents("saved-code/".$file);
        $json = json_decode($str, true);

        $containerClass = "fileitem";
        if ($i % 2 == 0) {
          $containerClass.=" alt";
        }
        $fn = str_replace(".json", "", $file);

        echo "<a href='".$fn."' class='".$containerClass."'><span class='filename'>".$fn."</span> <span class='filetitle'>".$json["name"]."</span></a><br/>";
        $i++;
      }
    }
  ?>

  
</body>
</html>

